import {
  type Book,
  EMPTY_BOOK,
  type Lang,
  type LanguagePack,
  type Rating,
  type WordState,
  applyLemmas,
  bookWords,
  buildBookFromChapters,
  buildDueQueue,
  defaultSelectedIds,
  onCardAdded,
  onCardRemoved,
  parseEpubChapters,
  rateReviewCard,
  rateSchedule,
  tapKnown,
  tapLearning,
  tapNew,
  wordStateFromSchedule,
} from "@glyphfern/core";
import { packs as defaultPacks } from "@glyphfern/languages";
import { startOfLocalDay } from "../review/review-queue";
import type { LanguageSnapshot, Repository, StoredBook } from "../storage/repository";
import type {
  AppActions,
  AppApi,
  AppState,
  Card,
  CardChange,
  FocusRequest,
  PreferenceKey,
  Preferences,
  Route,
  StateChange,
  TapTarget,
} from "./api";
import { allocateSlot } from "./book-slot";
import { defaultPreferences, readPrefersReducedMotion } from "./defaults";
import { lemmaChanges, migrateProgress } from "./lemma-migration";
import { hashFromRoute, routeFromHash } from "./route";

const NEW_STATE: WordState = { kind: "new" };
const SENTENCE_ID_SPAN = 1_000_000;
const IMPORT_LANG: Lang = "es";
const IMPORT_LOCALE = "es";

function booksView(
  base: LanguagePack,
  userBooks: readonly StoredBook[],
  bookId: string | null,
): { pack: LanguagePack; books: Book[] } {
  const ofLang = userBooks.filter((stored) => stored.lang === base.lang);
  const active = ofLang.find((stored) => stored.id === bookId);
  return {
    pack: { ...base, book: active ? active.book : EMPTY_BOOK },
    books: ofLang.map((stored) => stored.book),
  };
}

export interface StoreOptions {
  packs?: Record<Lang, LanguagePack>;
  prefersReducedMotion?: boolean;
  initialRoute?: Route;
  lemmatizer?: Lemmatizer;
  now?: () => number;
  random?: () => number;
}

export type Lemmatizer = (lang: Lang, words: string[]) => Promise<Record<string, string> | null>;

type Listener = () => void;

type LoadedData = Pick<
  AppState,
  | "lang"
  | "pack"
  | "books"
  | "userBooks"
  | "wordStates"
  | "cards"
  | "bookmarks"
  | "pins"
  | "preferences"
>;

export class AppStore {
  private readonly listeners = new Set<Listener>();
  private api: AppApi;
  private readonly pending = new Set<Promise<void>>();
  private relemmatizing: Promise<void> | null = null;

  private constructor(
    private readonly repository: Repository,
    private readonly packs: Record<Lang, LanguagePack>,
    private current: AppState,
    private readonly lemmatizer: Lemmatizer | undefined,
    private readonly now: () => number,
    private readonly random: () => number,
    private readonly defaults: Preferences,
  ) {
    this.api = this.buildApi();
  }

  static async open(repository: Repository, options: StoreOptions = {}): Promise<AppStore> {
    const packs = options.packs ?? defaultPacks;
    const defaults = defaultPreferences(options.prefersReducedMotion ?? readPrefersReducedMotion());
    const loaded = await AppStore.load(repository, packs, defaults, undefined);
    const state: AppState = {
      route: options.initialRoute ?? routeFromHash(readLocationHash()),
      focusRequest: null,
      persistence: repository.kind,
      ...loaded,
    };
    const store = new AppStore(
      repository,
      packs,
      state,
      options.lemmatizer,
      options.now ?? Date.now,
      options.random ?? Math.random,
      defaults,
    );
    store.persist(store.relemmatizePending());
    return store;
  }

  private static async load(
    repository: Repository,
    packs: Record<Lang, LanguagePack>,
    defaults: Preferences,
    currentLang: Lang | undefined,
  ): Promise<LoadedData> {
    const stored = await repository.loadPreferences();
    const merged: Preferences = { ...defaults, ...stored };
    const preferences: Preferences = { ...merged, positions: { ...merged.positions } };
    const wanted = currentLang ?? preferences.lang;
    const lang: Lang = packs[wanted] ? wanted : defaults.lang;
    const base = packs[lang];
    const snapshot = await repository.loadLanguage(base.lang);
    const pins = await repository.loadPins();
    const userBooks = await repository.loadBooks();
    const bookId = userBooks.some((stored) => stored.id === preferences.bookId)
      ? preferences.bookId
      : null;
    const view = booksView(base, userBooks, bookId);
    return {
      lang,
      pack: view.pack,
      books: view.books,
      userBooks,
      wordStates: snapshot.states,
      cards: snapshot.cards,
      bookmarks: snapshot.bookmarks,
      pins,
      preferences: { ...preferences, lang, bookId },
    };
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getApi = (): AppApi => this.api;

  attachRouting(target: Pick<Window, "addEventListener" | "removeEventListener" | "location">) {
    const onHashChange = () => this.setRoute(routeFromHash(target.location.hash));
    target.addEventListener("hashchange", onHashChange);
    return () => target.removeEventListener("hashchange", onHashChange);
  }

  readonly actions: AppActions = {
    navigate: (route) => {
      this.setRoute(route);
      writeLocationHash(route);
    },

    setWordState: (lemma, target) => {
      const previous = this.stateOf(lemma);
      const next = this.stateAfterTap(previous, target);
      this.commitWordState(lemma, next);
      return stateChange(previous, next);
    },

    addCard: (lemma, sentenceId): CardChange => {
      const previous = this.stateOf(lemma);
      if (this.current.cards.some((card) => card.lemma === lemma)) {
        return { state: previous, pulse: false, added: false };
      }
      const card: Card = { lemma, sentenceId };
      const next = onCardAdded(previous);
      this.patch({ cards: [...this.current.cards, card] });
      this.persist(this.repository.saveCard(this.current.lang, card));
      this.commitWordState(lemma, next);
      return { ...stateChange(previous, next), added: true };
    },

    removeCard: (lemma) => {
      if (!this.current.cards.some((card) => card.lemma === lemma)) {
        return;
      }
      const previous = this.stateOf(lemma);
      this.patch({ cards: this.current.cards.filter((card) => card.lemma !== lemma) });
      this.persist(this.repository.deleteCard(this.current.lang, lemma));
      this.commitWordState(lemma, onCardRemoved(previous));
    },

    toggleBookmark: (sentenceId) => {
      const has = this.current.bookmarks.includes(sentenceId);
      const bookmarks = has
        ? this.current.bookmarks.filter((id) => id !== sentenceId)
        : [...this.current.bookmarks, sentenceId];
      this.patch({ bookmarks });
      this.persist(this.repository.saveBookmarks(this.current.lang, bookmarks));
    },

    togglePin: (bookId) => {
      const pins = this.current.pins.includes(bookId)
        ? this.current.pins.filter((id) => id !== bookId)
        : [...this.current.pins, bookId];
      this.patch({ pins });
      this.persist(this.repository.savePins(pins));
    },

    setPreference: <K extends PreferenceKey>(key: K, value: Preferences[K]) => {
      const preferences: Preferences = { ...this.current.preferences, [key]: value };
      this.patch({ preferences });
      this.persistPreferences(preferences);
    },

    previewEpub: (files) => parseEpubChapters(files, this.importParseOptions()),

    importEpub: async (files, chapterIds) => {
      const seq = allocateSlot(
        this.current.userBooks.map((stored) => stored.seq),
        this.random,
      );
      const id = `user-${seq}-${Date.now().toString(36)}`;
      const preview = parseEpubChapters(files, this.importParseOptions());
      const defaults = defaultSelectedIds(preview);
      const selected =
        chapterIds ??
        (defaults.length > 0 ? defaults : preview.chapters.map((chapter) => chapter.id));
      const { book } = buildBookFromChapters(preview, selected, {
        id,
        lang: IMPORT_LANG,
        locale: IMPORT_LOCALE,
        firstSentenceId: seq * SENTENCE_ID_SPAN,
      });
      const lemmas = this.lemmatizer ? await this.lemmatizer(IMPORT_LANG, bookWords(book)) : null;
      const stored: StoredBook = {
        id,
        lang: IMPORT_LANG,
        seq,
        addedAt: Date.now(),
        lemmatized: lemmas !== null,
        book: applyLemmas(book, lemmas ?? {}),
      };
      await this.repository.saveBook(stored);
      const userBooks = [...this.current.userBooks, stored];
      const view = booksView(
        this.packs[this.current.lang],
        userBooks,
        this.current.preferences.bookId,
      );
      this.patch({ userBooks, books: view.books, pack: view.pack });
      return stored;
    },

    openBook: async (bookId) => {
      const stored = this.current.userBooks.find((candidate) => candidate.id === bookId);
      if (stored) {
        this.activate(stored.id);
      }
    },

    deleteBook: (bookId) => {
      const stored = this.current.userBooks.find((candidate) => candidate.id === bookId);
      if (!stored) {
        return;
      }
      const inBook = (sentenceId: number) =>
        Math.floor(sentenceId / SENTENCE_ID_SPAN) === stored.seq;
      for (const card of this.current.cards.filter((candidate) => inBook(candidate.sentenceId))) {
        this.actions.removeCard(card.lemma);
      }
      const bookmarks = this.current.bookmarks.filter((sentenceId) => !inBook(sentenceId));
      const userBooks = this.current.userBooks.filter((candidate) => candidate.id !== bookId);
      const wasActive = this.current.preferences.bookId === bookId;
      const pins = this.current.pins.filter((id) => id !== bookId);
      const view = booksView(
        this.packs[this.current.lang],
        userBooks,
        wasActive ? null : this.current.preferences.bookId,
      );
      const preferences: Preferences = wasActive
        ? { ...this.current.preferences, bookId: null }
        : this.current.preferences;
      delete preferences.positions[bookId];
      this.patch({ userBooks, books: view.books, pack: view.pack, bookmarks, pins, preferences });
      this.persist(this.repository.deleteBook(bookId));
      this.persist(this.repository.saveBookmarks(this.current.lang, bookmarks));
      this.persist(this.repository.savePins(pins));
      this.persistPreferences(preferences);
    },

    rememberPosition: (bookId, sentenceId) => {
      const { positions } = this.current.preferences;
      if (positions[bookId] === sentenceId) {
        return;
      }
      positions[bookId] = sentenceId;
      this.persistPreferences(this.current.preferences);
    },

    rateCard: (queue, rating) => {
      const lemma = queue[0];
      const card = this.current.cards.find((candidate) => candidate.lemma === lemma);
      if (card) {
        this.rateStoredCard(card, rating);
      }
      return rateReviewCard(queue, rating);
    },

    startReview: async () => {
      const lang = this.current.lang;
      await this.settled();
      const now = this.now();
      const newCardsToday = await this.repository.countNewReviewsSince(lang, startOfLocalDay(now));
      if (lang !== this.current.lang) {
        return this.actions.startReview();
      }
      return buildDueQueue(this.current.cards, now, newCardsToday);
    },

    reload: async () => {
      let loaded: LoadedData;
      do {
        await this.settled();
        loaded = await AppStore.load(this.repository, this.packs, this.defaults, this.current.lang);
      } while (this.pending.size > 0);
      this.patch(loaded);
    },

    requestFocus: (request) => {
      this.patch({ focusRequest: request });
    },

    consumeFocus: (): FocusRequest | null => {
      const request = this.current.focusRequest;
      if (request) {
        this.patch({ focusRequest: null });
      }
      return request;
    },
  };

  relemmatizePending(): Promise<void> {
    this.relemmatizing ??= this.relemmatizeEach().finally(() => {
      this.relemmatizing = null;
    });
    return this.relemmatizing;
  }

  private async relemmatizeEach(): Promise<void> {
    if (!this.lemmatizer) {
      return;
    }
    const pendingIds = this.current.userBooks
      .filter((stored) => stored.lemmatized !== true)
      .map((stored) => stored.id);
    for (const id of pendingIds) {
      await this.relemmatize(id, this.lemmatizer);
    }
  }

  private async relemmatize(bookId: string, lemmatizer: Lemmatizer): Promise<void> {
    const before = this.current.userBooks.find((candidate) => candidate.id === bookId);
    if (!before) {
      return;
    }
    const lemmas = await lemmatizer(before.lang, bookWords(before.book));
    if (lemmas === null) {
      return;
    }
    const stored = this.current.userBooks.find((candidate) => candidate.id === bookId);
    if (!stored) {
      return;
    }
    const book = applyLemmas(stored.book, lemmas);
    const updated: StoredBook = { ...stored, book, lemmatized: true };
    const userBooks = this.current.userBooks.map((candidate) =>
      candidate.id === bookId ? updated : candidate,
    );
    const view = booksView(
      this.packs[this.current.lang],
      userBooks,
      this.current.preferences.bookId,
    );
    this.persist(this.repository.saveBook(updated));
    this.patch({ userBooks, books: view.books, pack: view.pack });
    const migration = migrateProgress(
      { states: this.current.wordStates, cards: this.current.cards },
      lemmaChanges(stored.book, book),
      (sentenceId) => Math.floor(sentenceId / SENTENCE_ID_SPAN) === stored.seq,
    );
    for (const lemma of migration.deletedCards) {
      this.persist(this.repository.deleteCard(stored.lang, lemma));
    }
    for (const card of migration.savedCards) {
      this.persist(this.repository.saveCard(stored.lang, card));
    }
    for (const { lemma, state } of migration.copiedStates) {
      this.persist(this.repository.saveWordState(stored.lang, lemma, state));
    }
    this.patch({ wordStates: migration.states, cards: migration.cards });
  }

  private importParseOptions() {
    return {
      lang: IMPORT_LANG,
      fallbackTitle: (chapterNumber: number) => `Capítulo ${chapterNumber}`,
    };
  }

  private activate(bookId: string | null) {
    if (bookId === this.current.preferences.bookId) {
      return;
    }
    const view = booksView(this.packs[this.current.lang], this.current.userBooks, bookId);
    const preferences: Preferences = { ...this.current.preferences, bookId };
    this.patch({ pack: view.pack, books: view.books, preferences });
    this.persistPreferences(preferences);
  }

  private persistPreferences(preferences: Preferences) {
    this.persist(
      this.repository.savePreferences({ ...preferences, positions: { ...preferences.positions } }),
    );
  }

  private rateStoredCard(card: Card, rating: Rating) {
    const reviewedAt = this.now();
    const after = rateSchedule(card.schedule, rating, reviewedAt);
    const rated: Card = { ...card, schedule: after };
    const lang = this.current.lang;
    this.patch({
      cards: this.current.cards.map((candidate) =>
        candidate.lemma === card.lemma ? rated : candidate,
      ),
    });
    this.persist(this.repository.saveCard(lang, rated));
    this.persist(
      this.repository.appendReview(lang, {
        lemma: card.lemma,
        sentenceId: card.sentenceId,
        rating,
        reviewedAt,
        before: card.schedule ?? null,
        after,
      }),
    );
    this.commitWordState(card.lemma, wordStateFromSchedule(after));
  }

  private stateOf(lemma: string): WordState {
    return this.current.wordStates[lemma] ?? NEW_STATE;
  }

  private stateAfterTap(previous: WordState, target: TapTarget): WordState {
    if (target === "new") {
      return tapNew();
    }
    if (target === "learning") {
      return tapLearning(previous);
    }
    return tapKnown();
  }

  private commitWordState(lemma: string, next: WordState) {
    const wordStates = { ...this.current.wordStates };
    if (next.kind === "new") {
      delete wordStates[lemma];
    } else {
      wordStates[lemma] = next;
    }
    this.patch({ wordStates });
    this.persist(this.repository.saveWordState(this.current.lang, lemma, next));
  }

  private setRoute(route: Route) {
    if (route !== this.current.route) {
      this.patch({ route });
    }
  }

  private patch(change: Partial<AppState>) {
    this.current = { ...this.current, ...change };
    this.api = this.buildApi();
    for (const listener of this.listeners) {
      listener();
    }
  }

  private persist(task: Promise<void>) {
    const guarded = task
      .catch(() => undefined)
      .then(() => {
        this.pending.delete(guarded);
      });
    this.pending.add(guarded);
  }

  settled = async (): Promise<void> => {
    while (this.pending.size > 0) {
      await Promise.all([...this.pending]);
    }
  };

  private buildApi(): AppApi {
    const state = this.current;
    return {
      state,
      actions: this.actions,
      stateOf: (lemma) => state.wordStates[lemma] ?? NEW_STATE,
    };
  }
}

function stateChange(previous: WordState, next: WordState): StateChange {
  return {
    state: next,
    pulse: previous.kind !== "learning" && next.kind === "learning",
  };
}

function readLocationHash(): string {
  try {
    return window.location.hash;
  } catch {
    return "";
  }
}

function writeLocationHash(route: Route) {
  try {
    if (window.location.hash !== hashFromRoute(route)) {
      window.location.hash = hashFromRoute(route);
    }
  } catch {
    return;
  }
}
