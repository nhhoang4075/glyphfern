import { type Lang, type ReviewLogEntry, type WordState, stateKey } from "@glyphfern/core";
import type { Card, Preferences } from "../app/api";
import { defaultPreferences } from "../app/defaults";
import { deepEqual } from "../sync/equal";
import { mergeRecord } from "../sync/merge";
import {
  type RemoteChange,
  applyPreferenceChange,
  bookEntry,
  bookmarksRecord,
  cardRecord,
  cardTombstone,
  decodeRecord,
  pinsRecord,
  preferenceRecords,
  reviewRecord,
  wordStateRecord,
} from "../sync/records";
import type { LocalData } from "../sync/snapshot";
import { createStamper } from "../sync/stamp";
import {
  type OutboxEntry,
  type PulledRecord,
  type SyncRecord,
  type SyncState,
  emptySyncState,
} from "../sync/types";
import type { LanguageSnapshot, Repository, StoredBook } from "./repository";
import { sortBooks } from "./repository";
import { isFirstReview } from "./review-log";

interface StoredCard extends Card {
  lang: Lang;
}

interface StoredReview {
  lang: Lang;
  entry: ReviewLogEntry;
}

function clonePreferences(preferences: Preferences): Preferences {
  return { ...preferences, positions: { ...preferences.positions } };
}

export class MemoryRepository implements Repository {
  readonly kind = "memory" as const;
  private preferences: Preferences | undefined;
  private pins: string[] = [];
  private readonly states = new Map<string, WordState>();
  private readonly cards = new Map<string, StoredCard>();
  private readonly bookmarks = new Map<Lang, number[]>();
  private readonly books = new Map<string, StoredBook>();
  private readonly reviewLog: StoredReview[] = [];
  private outbox: OutboxEntry[] = [];
  private outboxId = 0;
  private syncState: SyncState = emptySyncState();
  private readonly stamp: () => number;
  private readonly listeners = new Set<() => void>();

  constructor(now: () => number = Date.now) {
    this.stamp = createStamper(now);
  }

  subscribeOutbox(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private enqueue(entries: readonly OutboxEntry[]) {
    for (const entry of entries) {
      this.outboxId += 1;
      this.outbox.push({ ...structuredClone(entry), id: this.outboxId });
    }
    for (const listener of this.listeners) {
      listener();
    }
  }

  async loadPreferences(): Promise<Preferences | undefined> {
    return this.preferences ? clonePreferences(this.preferences) : undefined;
  }

  async savePreferences(preferences: Preferences): Promise<void> {
    const previous = this.preferences;
    this.preferences = clonePreferences(preferences);
    this.enqueue(preferenceRecords(previous, preferences, this.stamp()));
  }

  async loadPins(): Promise<string[]> {
    return [...this.pins];
  }

  async savePins(pins: readonly string[]): Promise<void> {
    this.pins = [...pins];
    this.enqueue([pinsRecord(pins, this.stamp())]);
  }

  async loadLanguage(lang: Lang): Promise<LanguageSnapshot> {
    const prefix = stateKey(lang, "");
    const states: Record<string, WordState> = {};
    for (const [key, state] of this.states) {
      if (key.startsWith(prefix)) {
        states[key.slice(prefix.length)] = state;
      }
    }
    const cards: Card[] = [];
    for (const card of this.cards.values()) {
      if (card.lang === lang) {
        const { lang: _lang, ...plain } = card;
        cards.push(structuredClone(plain));
      }
    }
    return { states, cards, bookmarks: [...(this.bookmarks.get(lang) ?? [])] };
  }

  async saveWordState(lang: Lang, lemma: string, state: WordState): Promise<void> {
    const key = stateKey(lang, lemma);
    if (state.kind === "new") {
      this.states.delete(key);
    } else {
      this.states.set(key, state);
    }
    this.enqueue([wordStateRecord(lang, lemma, state, this.stamp())]);
  }

  async saveCard(lang: Lang, card: Card): Promise<void> {
    this.cards.set(stateKey(lang, card.lemma), { ...structuredClone(card), lang });
    this.enqueue([cardRecord(lang, card, this.stamp())]);
  }

  async deleteCard(lang: Lang, lemma: string): Promise<void> {
    this.cards.delete(stateKey(lang, lemma));
    this.enqueue([cardTombstone(lang, lemma, this.stamp())]);
  }

  async appendReview(lang: Lang, entry: ReviewLogEntry): Promise<void> {
    this.reviewLog.push({ lang, entry: structuredClone(entry) });
    this.enqueue([reviewRecord(lang, entry)]);
  }

  async countNewReviewsSince(lang: Lang, since: number): Promise<number> {
    return this.reviewLog.filter(
      (row) => row.lang === lang && row.entry.reviewedAt >= since && isFirstReview(row.entry),
    ).length;
  }

  async loadReviewLog(lang: Lang): Promise<ReviewLogEntry[]> {
    return this.reviewLog
      .filter((row) => row.lang === lang)
      .map((row) => structuredClone(row.entry))
      .sort((a, b) => a.reviewedAt - b.reviewedAt);
  }

  async saveBookmarks(lang: Lang, sentenceIds: readonly number[]): Promise<void> {
    this.bookmarks.set(lang, [...sentenceIds]);
    this.enqueue([bookmarksRecord(lang, sentenceIds, this.stamp())]);
  }

  async loadBooks(): Promise<StoredBook[]> {
    return sortBooks([...this.books.values()]);
  }

  async saveBook(book: StoredBook): Promise<void> {
    this.books.set(book.id, book);
    this.enqueue([bookEntry(book.id, this.stamp(), false)]);
  }

  async deleteBook(id: string): Promise<void> {
    this.books.delete(id);
    this.enqueue([bookEntry(id, this.stamp(), true)]);
  }

  async readOutbox(): Promise<OutboxEntry[]> {
    return this.outbox.map((entry) => structuredClone(entry));
  }

  async appendOutbox(entries: readonly OutboxEntry[]): Promise<void> {
    this.enqueue(entries.map(({ id: _id, ...entry }) => entry));
  }

  async removeOutbox(ids: readonly number[]): Promise<void> {
    const removed = new Set(ids);
    this.outbox = this.outbox.filter((entry) => !removed.has(entry.id as number));
  }

  async loadSyncState(): Promise<SyncState> {
    return { ...this.syncState, bookUploaded: [...this.syncState.bookUploaded] };
  }

  async saveSyncState(state: SyncState): Promise<void> {
    this.syncState = { ...state, bookUploaded: [...state.bookUploaded] };
  }

  async exportLocal(): Promise<LocalData> {
    const wordStates: LocalData["wordStates"] = [];
    for (const [key, state] of this.states) {
      const index = key.indexOf(":");
      wordStates.push({
        lang: key.slice(0, index) as Lang,
        lemma: key.slice(index + 1),
        state: structuredClone(state),
      });
    }
    return {
      wordStates,
      cards: [...this.cards.values()].map(({ lang, ...card }) => ({
        lang,
        card: structuredClone(card),
      })),
      reviews: this.reviewLog.map((row) => ({ lang: row.lang, entry: structuredClone(row.entry) })),
      bookmarks: [...this.bookmarks].map(([lang, sentenceIds]) => ({
        lang,
        sentenceIds: [...sentenceIds],
      })),
      pins: [...this.pins],
      preferences: this.preferences ? clonePreferences(this.preferences) : undefined,
    };
  }

  async applyRemote(records: readonly PulledRecord[]): Promise<boolean> {
    let any = false;
    for (const record of records) {
      const change = decodeRecord(record);
      if (change && this.shouldApply(record)) {
        any = this.applyChange(change) || any;
      }
    }
    return any;
  }

  async applyRemoteBook(book: StoredBook): Promise<void> {
    this.books.set(book.id, book);
  }

  async removeRemoteBook(id: string): Promise<void> {
    this.books.delete(id);
  }

  private shouldApply(record: SyncRecord): boolean {
    const pending = this.outbox.filter(
      (entry) => entry.kind === record.kind && entry.key === record.key,
    );
    const latest = pending.reduce<OutboxEntry | undefined>(
      (best, entry) => (!best || entry.updatedAt >= best.updatedAt ? entry : best),
      undefined,
    );
    if (record.kind === "review") {
      return !latest;
    }
    if (mergeRecord(latest, record) === "local") {
      return false;
    }
    const drop = new Set(pending.map((entry) => entry.id));
    this.outbox = this.outbox.filter((entry) => !drop.has(entry.id));
    return true;
  }

  private applyChange(change: RemoteChange): boolean {
    if (change.type === "wordState") {
      const key = stateKey(change.lang, change.lemma);
      const existing = this.states.get(key);
      if (change.state === null) {
        return this.states.delete(key);
      }
      if (existing && deepEqual(existing, change.state)) {
        return false;
      }
      this.states.set(key, structuredClone(change.state));
      return true;
    }
    if (change.type === "card") {
      const key = stateKey(change.lang, change.lemma);
      const existing = this.cards.get(key);
      if (change.card === null) {
        return this.cards.delete(key);
      }
      const next: StoredCard = { ...structuredClone(change.card), lang: change.lang };
      if (existing && deepEqual(existing, next)) {
        return false;
      }
      this.cards.set(key, next);
      return true;
    }
    if (change.type === "review") {
      const duplicate = this.reviewLog.some(
        (row) =>
          row.lang === change.lang &&
          row.entry.reviewedAt === change.entry.reviewedAt &&
          row.entry.lemma === change.entry.lemma,
      );
      if (duplicate) {
        return false;
      }
      this.reviewLog.push({ lang: change.lang, entry: structuredClone(change.entry) });
      return true;
    }
    if (change.type === "bookmarks") {
      if (deepEqual(this.bookmarks.get(change.lang) ?? [], change.sentenceIds)) {
        return false;
      }
      this.bookmarks.set(change.lang, [...change.sentenceIds]);
      return true;
    }
    if (change.type === "pins") {
      if (deepEqual(this.pins, change.bookIds)) {
        return false;
      }
      this.pins = [...change.bookIds];
      return true;
    }
    const base = this.preferences ?? defaultPreferences(false);
    const next = applyPreferenceChange(base, change);
    if (this.preferences && deepEqual(this.preferences, next)) {
      return false;
    }
    this.preferences = next;
    return true;
  }
}
