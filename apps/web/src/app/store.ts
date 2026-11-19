import {
  type Book,
  type Lang,
  type LanguagePack,
  type Rating,
  type WordState,
  buildEpubBook,
  onCardAdded,
  onCardRemoved,
  onRated,
  rateReviewCard,
  tapKnown,
  tapLearning,
  tapNew,
} from "@glyphfern/core";
import { packs as defaultPacks } from "@glyphfern/languages";
import type { LanguageSnapshot, Repository, StoredBook } from "../storage/repository";
import { ensureLanguage } from "../storage/seed";
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
import { defaultPreferences, readPrefersReducedMotion } from "./defaults";
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
    pack: active ? { ...base, book: active.book } : base,
    books: [base.book, ...ofLang.map((stored) => stored.book)],
  };
}

export interface StoreOptions {
  packs?: Record<Lang, LanguagePack>;
  prefersReducedMotion?: boolean;
  initialRoute?: Route;
}

type Listener = () => void;

export class AppStore {
  private readonly listeners = new Set<Listener>();
  private readonly loaded = new Map<Lang, LanguageSnapshot>();
  private api: AppApi;
  private readonly pending = new Set<Promise<void>>();
  private switchToken = 0;

  private constructor(
    private readonly repository: Repository,
    private readonly packs: Record<Lang, LanguagePack>,
    private current: AppState,
  ) {
    this.api = this.buildApi();
  }

  static async open(repository: Repository, options: StoreOptions = {}): Promise<AppStore> {
    const packs = options.packs ?? defaultPacks;
    const defaults = defaultPreferences(options.prefersReducedMotion ?? readPrefersReducedMotion());
    const stored = await repository.loadPreferences();
    const preferences: Preferences = { ...defaults, ...stored };
    const lang: Lang = packs[preferences.lang] ? preferences.lang : defaults.lang;
    const base = packs[lang];
    const snapshot = await ensureLanguage(repository, base);
    const pins = await repository.loadPins();
    const userBooks = await repository.loadBooks();
    const bookId = userBooks.some((stored) => stored.id === preferences.bookId)
      ? preferences.bookId
      : null;
    const view = booksView(base, userBooks, bookId);
    const state: AppState = {
      route: options.initialRoute ?? routeFromHash(readLocationHash()),
      lang,
      pack: view.pack,
      books: view.books,
      userBooks,
      wordStates: snapshot.states,
      cards: snapshot.cards,
      bookmarks: snapshot.bookmarks,
      pins,
      preferences: { ...preferences, lang, bookId },
      focusRequest: null,
      persistence: repository.kind,
    };
    const store = new AppStore(repository, packs, state);
    store.loaded.set(lang, snapshot);
    return store;
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
      this.persist(this.repository.savePreferences(preferences));
    },

    switchLanguage: (lang) => this.activate(lang, null),

    importEpub: async (files) => {
      const seq = this.current.userBooks.reduce((max, stored) => Math.max(max, stored.seq), 0) + 1;
      const id = `user-${seq}-${Date.now().toString(36)}`;
      const { book } = buildEpubBook(files, {
        id,
        lang: IMPORT_LANG,
        locale: IMPORT_LOCALE,
        firstSentenceId: seq * SENTENCE_ID_SPAN,
        fallbackTitle: (chapterNumber) => `Capítulo ${chapterNumber}`,
      });
      const stored: StoredBook = { id, lang: IMPORT_LANG, seq, addedAt: Date.now(), book };
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
        await this.activate(stored.lang, stored.id);
        return;
      }
      const sampleLang = (Object.keys(this.packs) as Lang[]).find(
        (lang) => this.packs[lang].book.id === bookId,
      );
      if (sampleLang) {
        await this.activate(sampleLang, null);
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
      this.patch({ userBooks, books: view.books, pack: view.pack, bookmarks, pins, preferences });
      this.persist(this.repository.deleteBook(bookId));
      this.persist(this.repository.saveBookmarks(this.current.lang, bookmarks));
      this.persist(this.repository.savePins(pins));
      this.persist(this.repository.savePreferences(preferences));
    },

    ratingApplied: (lemma, rating: Rating) => {
      const next = onRated(this.stateOf(lemma), rating);
      this.commitWordState(lemma, next);
      return next;
    },

    rateCard: (queue, rating) => {
      const lemma = queue[0];
      if (lemma === undefined) {
        return [];
      }
      const result = rateReviewCard(queue, rating, this.stateOf(lemma));
      this.commitWordState(lemma, result.state);
      return result.queue;
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

  private async activate(lang: Lang, bookId: string | null): Promise<void> {
    if (lang === this.current.lang && bookId === this.current.preferences.bookId) {
      return;
    }
    this.switchToken += 1;
    const token = this.switchToken;
    const base = this.packs[lang];
    const sameLang = lang === this.current.lang;
    const snapshot = sameLang
      ? undefined
      : (this.loaded.get(lang) ?? (await ensureLanguage(this.repository, base)));
    if (token !== this.switchToken) {
      return;
    }
    const view = booksView(base, this.current.userBooks, bookId);
    const preferences: Preferences = { ...this.current.preferences, lang, bookId };
    if (snapshot) {
      this.loaded.set(this.current.lang, this.currentSnapshot());
      this.loaded.set(lang, snapshot);
      this.patch({
        lang,
        pack: view.pack,
        books: view.books,
        wordStates: snapshot.states,
        cards: snapshot.cards,
        bookmarks: snapshot.bookmarks,
        preferences,
      });
    } else {
      this.patch({ pack: view.pack, books: view.books, preferences });
    }
    this.persist(this.repository.savePreferences(preferences));
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

  private currentSnapshot(): LanguageSnapshot {
    return {
      states: { ...this.current.wordStates },
      cards: [...this.current.cards],
      bookmarks: [...this.current.bookmarks],
    };
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
