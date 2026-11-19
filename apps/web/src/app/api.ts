import type { Book, Lang, LanguagePack, Rating, WordState } from "@glyphfern/core";
import type { StoredBook } from "../storage/repository";

export type Route = "library" | "read" | "words" | "review";

export const ROUTES: readonly Route[] = ["library", "read", "words", "review"];

export const DEFAULT_ROUTE: Route = "read";

export type FontKey = "serif" | "sans";
export type TurnStyle = "slide" | "curl" | "still";
export type LineHeight = 1.45 | 1.62 | 1.85;
export type PaperColor = "#FCFBF9" | "#F1EDE4" | "#1B2420";

export interface Preferences {
  size: number;
  lh: LineHeight;
  font: FontKey;
  paper: PaperColor;
  turn: TurnStyle;
  hl: 0 | 1;
  lang: Lang;
  bookId: string | null;
  positions: Record<string, number>;
}

export type PreferenceKey = Exclude<keyof Preferences, "lang" | "bookId" | "positions">;

export interface Card {
  lemma: string;
  sentenceId: number;
}

export interface FocusRequest {
  lemma: string;
  sentenceId: number;
}

export type TapTarget = "new" | "learning" | "known";

export interface StateChange {
  state: WordState;
  pulse: boolean;
}

export interface CardChange extends StateChange {
  added: boolean;
}

export type PersistenceKind = "indexeddb" | "memory";

export interface AppState {
  route: Route;
  lang: Lang;
  pack: LanguagePack;
  books: readonly Book[];
  userBooks: readonly StoredBook[];
  wordStates: Readonly<Record<string, WordState>>;
  cards: readonly Card[];
  bookmarks: readonly number[];
  pins: readonly string[];
  preferences: Preferences;
  focusRequest: FocusRequest | null;
  persistence: PersistenceKind;
}

export interface AppActions {
  navigate(route: Route): void;
  setWordState(lemma: string, target: TapTarget): StateChange;
  addCard(lemma: string, sentenceId: number): CardChange;
  removeCard(lemma: string): void;
  toggleBookmark(sentenceId: number): void;
  togglePin(bookId: string): void;
  setPreference<K extends PreferenceKey>(key: K, value: Preferences[K]): void;
  switchLanguage(lang: Lang): Promise<void>;
  importEpub(files: Readonly<Record<string, string>>): Promise<StoredBook>;
  openBook(bookId: string): Promise<void>;
  deleteBook(bookId: string): void;
  rememberPosition(bookId: string, sentenceId: number): void;
  ratingApplied(lemma: string, rating: Rating): WordState;
  rateCard(queue: readonly string[], rating: Rating): string[];
  requestFocus(request: FocusRequest): void;
  consumeFocus(): FocusRequest | null;
}

export interface AppApi {
  state: AppState;
  actions: AppActions;
  stateOf(lemma: string): WordState;
}
