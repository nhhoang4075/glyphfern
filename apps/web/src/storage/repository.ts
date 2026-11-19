import type { Book, Lang, ReviewLogEntry, WordState } from "@glyphfern/core";
import type { Card, PersistenceKind, Preferences } from "../app/api";
import type { LocalData } from "../sync/snapshot";
import type { OutboxEntry, PulledRecord, SyncState } from "../sync/types";

export interface LanguageSnapshot {
  states: Record<string, WordState>;
  cards: Card[];
  bookmarks: number[];
}

export interface StoredBook {
  id: string;
  lang: Lang;
  seq: number;
  addedAt: number;
  lemmatized?: boolean;
  book: Book;
}

export interface Repository {
  readonly kind: PersistenceKind;
  loadPreferences(): Promise<Preferences | undefined>;
  savePreferences(preferences: Preferences): Promise<void>;
  loadPins(): Promise<string[]>;
  savePins(pins: readonly string[]): Promise<void>;
  loadLanguage(lang: Lang): Promise<LanguageSnapshot>;
  saveWordState(lang: Lang, lemma: string, state: WordState): Promise<void>;
  saveCard(lang: Lang, card: Card): Promise<void>;
  deleteCard(lang: Lang, lemma: string): Promise<void>;
  appendReview(lang: Lang, entry: ReviewLogEntry): Promise<void>;
  countNewReviewsSince(lang: Lang, since: number): Promise<number>;
  loadReviewLog(lang: Lang): Promise<ReviewLogEntry[]>;
  saveBookmarks(lang: Lang, sentenceIds: readonly number[]): Promise<void>;
  loadBooks(): Promise<StoredBook[]>;
  saveBook(book: StoredBook): Promise<void>;
  deleteBook(id: string): Promise<void>;
  subscribeOutbox(listener: () => void): () => void;
  readOutbox(): Promise<OutboxEntry[]>;
  appendOutbox(entries: readonly OutboxEntry[]): Promise<void>;
  removeOutbox(ids: readonly number[]): Promise<void>;
  loadSyncState(): Promise<SyncState>;
  saveSyncState(state: SyncState): Promise<void>;
  exportLocal(): Promise<LocalData>;
  applyRemote(records: readonly PulledRecord[]): Promise<boolean>;
  applyRemoteBook(book: StoredBook): Promise<void>;
  removeRemoteBook(id: string): Promise<void>;
}

export function sortBooks(books: readonly StoredBook[]): StoredBook[] {
  return [...books].sort((a, b) => a.addedAt - b.addedAt || a.seq - b.seq);
}
