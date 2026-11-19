import {
  type Lang,
  type LanguagePack,
  type Rating,
  type WordState,
  onCardAdded,
  onCardRemoved,
  onRated,
  rateReviewCard,
  tapKnown,
  tapLearning,
  tapNew,
} from "@glyphfern/core";
import { packs as defaultPacks } from "@glyphfern/languages";
import type { LanguageSnapshot, Repository } from "../storage/repository";
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
    const pack = packs[lang];
    const snapshot = await ensureLanguage(repository, pack);
    const pins = await repository.loadPins();
    const state: AppState = {
      route: options.initialRoute ?? routeFromHash(readLocationHash()),
      lang,
      pack,
      wordStates: snapshot.states,
      cards: snapshot.cards,
      bookmarks: snapshot.bookmarks,
      pins,
      preferences: { ...preferences, lang },
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

    switchLanguage: async (lang) => {
      if (lang === this.current.lang) {
        return;
      }
      this.switchToken += 1;
      const token = this.switchToken;
      const pack = this.packs[lang];
      const snapshot = this.loaded.get(lang) ?? (await ensureLanguage(this.repository, pack));
      if (token !== this.switchToken) {
        return;
      }
      this.loaded.set(this.current.lang, this.currentSnapshot());
      this.loaded.set(lang, snapshot);
      const preferences: Preferences = { ...this.current.preferences, lang };
      this.patch({
        lang,
        pack,
        wordStates: snapshot.states,
        cards: snapshot.cards,
        bookmarks: snapshot.bookmarks,
        preferences,
      });
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
