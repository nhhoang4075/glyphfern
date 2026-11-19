import {
  type CardSchedule,
  type Lang,
  type ReviewLogEntry,
  type WordState,
  stateKey,
} from "@glyphfern/core";
import Dexie, { type DexieOptions, type Table } from "dexie";
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

export const DATABASE_NAME = "glyphfern";
const PREFERENCES_ID = "main";
const SYNC_STATE_ID = "main";

export interface WordStateRow {
  key: string;
  lang: Lang;
  lemma: string;
  state: WordState;
}

export interface CardRow {
  key: string;
  lang: Lang;
  lemma: string;
  sentenceId: number;
  seq: number;
  schedule?: CardSchedule;
}

export interface ReviewLogRow extends ReviewLogEntry {
  id?: number;
  lang: Lang;
}

export interface BookmarkRow {
  lang: Lang;
  sentenceIds: number[];
}

export interface PinRow {
  bookId: string;
  order: number;
}

export interface PreferencesRow extends Preferences {
  id: string;
}

export interface MetaRow {
  key: string;
  value: boolean;
}

export interface SyncStateRow extends SyncState {
  id: string;
}

export class GlyphfernDatabase extends Dexie {
  readonly wordStates: Table<WordStateRow, string>;
  readonly cards: Table<CardRow, string>;
  readonly bookmarks: Table<BookmarkRow, Lang>;
  readonly pins: Table<PinRow, string>;
  readonly preferences: Table<PreferencesRow, string>;
  readonly meta: Table<MetaRow, string>;
  readonly books: Table<StoredBook, string>;
  readonly reviewLog: Table<ReviewLogRow, number>;
  readonly outbox: Table<OutboxEntry, number>;
  readonly syncState: Table<SyncStateRow, string>;

  constructor(name: string = DATABASE_NAME, options?: DexieOptions) {
    super(name, options);
    this.version(1).stores({
      wordStates: "key, lang",
      cards: "key, lang",
      bookmarks: "lang",
      pins: "bookId, order",
      preferences: "id",
      meta: "key",
    });
    this.version(2).stores({ books: "id, lang" });
    this.version(3).stores({ reviewLog: "++id, lang, reviewedAt, [lang+reviewedAt]" });
    this.version(4).stores({
      outbox: "++id, kind, key, [kind+key], updatedAt",
      syncState: "id",
    });
    this.reviewLog = this.table("reviewLog");
    this.books = this.table("books");
    this.wordStates = this.table("wordStates");
    this.cards = this.table("cards");
    this.bookmarks = this.table("bookmarks");
    this.pins = this.table("pins");
    this.preferences = this.table("preferences");
    this.meta = this.table("meta");
    this.outbox = this.table("outbox");
    this.syncState = this.table("syncState");
  }
}

export class DexieRepository implements Repository {
  readonly kind = "indexeddb" as const;
  private cardSeq = 0;
  private readonly stamp: () => number;
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly db: GlyphfernDatabase,
    now: () => number = Date.now,
  ) {
    this.stamp = createStamper(now);
  }

  subscribeOutbox(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      listener();
    }
  }

  async loadPreferences(): Promise<Preferences | undefined> {
    const row = await this.db.preferences.get(PREFERENCES_ID);
    if (!row) {
      return undefined;
    }
    const { id: _id, ...preferences } = row;
    return preferences;
  }

  async savePreferences(preferences: Preferences): Promise<void> {
    await this.db.transaction("rw", this.db.preferences, this.db.outbox, async () => {
      const previous = await this.loadPreferences();
      await this.db.preferences.put({
        id: PREFERENCES_ID,
        ...preferences,
        positions: { ...preferences.positions },
      });
      await this.db.outbox.bulkAdd(preferenceRecords(previous, preferences, this.stamp()));
    });
    this.notify();
  }

  async loadPins(): Promise<string[]> {
    const rows = await this.db.pins.orderBy("order").toArray();
    return rows.map((row) => row.bookId);
  }

  async savePins(pins: readonly string[]): Promise<void> {
    await this.db.transaction("rw", this.db.pins, this.db.outbox, async () => {
      await this.db.pins.clear();
      await this.db.pins.bulkPut(pins.map((bookId, order) => ({ bookId, order })));
      await this.db.outbox.add(pinsRecord(pins, this.stamp()));
    });
    this.notify();
  }

  async loadLanguage(lang: Lang): Promise<LanguageSnapshot> {
    const [stateRows, cardRows, bookmarkRow] = await Promise.all([
      this.db.wordStates.where("lang").equals(lang).toArray(),
      this.db.cards.where("lang").equals(lang).toArray(),
      this.db.bookmarks.get(lang),
    ]);
    const states: Record<string, WordState> = {};
    for (const row of stateRows) {
      states[row.lemma] = row.state;
    }
    const cards = cardRows
      .sort((a, b) => a.seq - b.seq)
      .map(
        (row): Card =>
          row.schedule
            ? { lemma: row.lemma, sentenceId: row.sentenceId, schedule: row.schedule }
            : { lemma: row.lemma, sentenceId: row.sentenceId },
      );
    for (const row of cardRows) {
      this.cardSeq = Math.max(this.cardSeq, row.seq + 1);
    }
    return { states, cards, bookmarks: [...(bookmarkRow?.sentenceIds ?? [])] };
  }

  async saveWordState(lang: Lang, lemma: string, state: WordState): Promise<void> {
    const key = stateKey(lang, lemma);
    await this.db.transaction("rw", this.db.wordStates, this.db.outbox, async () => {
      if (state.kind === "new") {
        await this.db.wordStates.delete(key);
      } else {
        await this.db.wordStates.put({ key, lang, lemma, state });
      }
      await this.db.outbox.add(wordStateRecord(lang, lemma, state, this.stamp()));
    });
    this.notify();
  }

  async saveCard(lang: Lang, card: Card): Promise<void> {
    await this.db.transaction("rw", this.db.cards, this.db.outbox, async () => {
      const existing = await this.db.cards.get(stateKey(lang, card.lemma));
      await this.db.cards.put(this.cardRow(lang, card, existing?.seq));
      await this.db.outbox.add(cardRecord(lang, card, this.stamp()));
    });
    this.notify();
  }

  async deleteCard(lang: Lang, lemma: string): Promise<void> {
    await this.db.transaction("rw", this.db.cards, this.db.outbox, async () => {
      await this.db.cards.delete(stateKey(lang, lemma));
      await this.db.outbox.add(cardTombstone(lang, lemma, this.stamp()));
    });
    this.notify();
  }

  async appendReview(lang: Lang, entry: ReviewLogEntry): Promise<void> {
    await this.db.transaction("rw", this.db.reviewLog, this.db.outbox, async () => {
      await this.db.reviewLog.add({ ...entry, lang });
      await this.db.outbox.add(reviewRecord(lang, entry));
    });
    this.notify();
  }

  async countNewReviewsSince(lang: Lang, since: number): Promise<number> {
    return this.db.reviewLog
      .where("[lang+reviewedAt]")
      .between([lang, since], [lang, Dexie.maxKey])
      .filter(isFirstReview)
      .count();
  }

  async loadReviewLog(lang: Lang): Promise<ReviewLogEntry[]> {
    const rows = await this.db.reviewLog
      .where("[lang+reviewedAt]")
      .between([lang, Dexie.minKey], [lang, Dexie.maxKey])
      .toArray();
    return rows.map(({ id: _id, lang: _lang, ...entry }) => entry);
  }

  async saveBookmarks(lang: Lang, sentenceIds: readonly number[]): Promise<void> {
    await this.db.transaction("rw", this.db.bookmarks, this.db.outbox, async () => {
      await this.db.bookmarks.put({ lang, sentenceIds: [...sentenceIds] });
      await this.db.outbox.add(bookmarksRecord(lang, sentenceIds, this.stamp()));
    });
    this.notify();
  }

  async loadBooks(): Promise<StoredBook[]> {
    return sortBooks(await this.db.books.toArray());
  }

  async saveBook(book: StoredBook): Promise<void> {
    await this.db.transaction("rw", this.db.books, this.db.outbox, async () => {
      await this.db.books.put(book);
      await this.db.outbox.add(bookEntry(book.id, this.stamp(), false));
    });
    this.notify();
  }

  async deleteBook(id: string): Promise<void> {
    await this.db.transaction("rw", this.db.books, this.db.outbox, async () => {
      await this.db.books.delete(id);
      await this.db.outbox.add(bookEntry(id, this.stamp(), true));
    });
    this.notify();
  }

  async readOutbox(): Promise<OutboxEntry[]> {
    return this.db.outbox.orderBy("id").toArray();
  }

  async appendOutbox(entries: readonly OutboxEntry[]): Promise<void> {
    await this.db.outbox.bulkAdd(entries.map(({ id: _id, ...entry }) => entry));
  }

  async removeOutbox(ids: readonly number[]): Promise<void> {
    await this.db.outbox.bulkDelete([...ids]);
  }

  async loadSyncState(): Promise<SyncState> {
    const row = await this.db.syncState.get(SYNC_STATE_ID);
    if (!row) {
      return emptySyncState();
    }
    const { id: _id, ...state } = row;
    return { ...state, bookUploaded: [...state.bookUploaded] };
  }

  async saveSyncState(state: SyncState): Promise<void> {
    await this.db.syncState.put({ id: SYNC_STATE_ID, ...state });
  }

  async exportLocal(): Promise<LocalData> {
    const [stateRows, cardRows, reviewRows, bookmarkRows, pins, preferences] = await Promise.all([
      this.db.wordStates.toArray(),
      this.db.cards.toArray(),
      this.db.reviewLog.toArray(),
      this.db.bookmarks.toArray(),
      this.loadPins(),
      this.loadPreferences(),
    ]);
    return {
      wordStates: stateRows.map(({ lang, lemma, state }) => ({ lang, lemma, state })),
      cards: cardRows
        .sort((a, b) => a.seq - b.seq)
        .map((row) => ({
          lang: row.lang,
          card: row.schedule
            ? { lemma: row.lemma, sentenceId: row.sentenceId, schedule: row.schedule }
            : { lemma: row.lemma, sentenceId: row.sentenceId },
        })),
      reviews: reviewRows.map(({ id: _id, lang, ...entry }) => ({ lang, entry })),
      bookmarks: bookmarkRows.map(({ lang, sentenceIds }) => ({ lang, sentenceIds })),
      pins,
      preferences,
    };
  }

  async applyRemote(records: readonly PulledRecord[]): Promise<boolean> {
    const changed = await this.db.transaction("rw", this.db.tables, async () => {
      await this.syncCardSeq();
      let any = false;
      for (const record of records) {
        const change = decodeRecord(record);
        if (change && (await this.shouldApply(record))) {
          any = (await this.applyChange(change)) || any;
        }
      }
      return any;
    });
    return changed;
  }

  async applyRemoteBook(book: StoredBook): Promise<void> {
    await this.db.books.put(book);
  }

  async removeRemoteBook(id: string): Promise<void> {
    await this.db.books.delete(id);
  }

  private async syncCardSeq() {
    for (const row of await this.db.cards.toArray()) {
      this.cardSeq = Math.max(this.cardSeq, row.seq + 1);
    }
  }

  private async shouldApply(record: SyncRecord): Promise<boolean> {
    const pending = await this.db.outbox
      .where("[kind+key]")
      .equals([record.kind, record.key])
      .toArray();
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
    if (pending.length > 0) {
      await this.db.outbox.bulkDelete(pending.map((entry) => entry.id as number));
    }
    return true;
  }

  private async applyChange(change: RemoteChange): Promise<boolean> {
    if (change.type === "wordState") {
      const key = stateKey(change.lang, change.lemma);
      const existing = await this.db.wordStates.get(key);
      if (change.state === null) {
        if (!existing) {
          return false;
        }
        await this.db.wordStates.delete(key);
        return true;
      }
      if (existing && deepEqual(existing.state, change.state)) {
        return false;
      }
      await this.db.wordStates.put({
        key,
        lang: change.lang,
        lemma: change.lemma,
        state: change.state,
      });
      return true;
    }
    if (change.type === "card") {
      const key = stateKey(change.lang, change.lemma);
      const existing = await this.db.cards.get(key);
      if (change.card === null) {
        if (!existing) {
          return false;
        }
        await this.db.cards.delete(key);
        return true;
      }
      const next = this.cardRow(change.lang, change.card, existing?.seq);
      if (existing && deepEqual(existing, next)) {
        return false;
      }
      await this.db.cards.put(next);
      return true;
    }
    if (change.type === "review") {
      const duplicate = await this.db.reviewLog
        .where("[lang+reviewedAt]")
        .equals([change.lang, change.entry.reviewedAt])
        .filter((row) => row.lemma === change.entry.lemma)
        .first();
      if (duplicate) {
        return false;
      }
      await this.db.reviewLog.add({ ...change.entry, lang: change.lang });
      return true;
    }
    if (change.type === "bookmarks") {
      const existing = await this.db.bookmarks.get(change.lang);
      if (deepEqual(existing?.sentenceIds ?? [], change.sentenceIds)) {
        return false;
      }
      await this.db.bookmarks.put({ lang: change.lang, sentenceIds: change.sentenceIds });
      return true;
    }
    if (change.type === "pins") {
      if (deepEqual(await this.loadPins(), change.bookIds)) {
        return false;
      }
      await this.db.pins.clear();
      await this.db.pins.bulkPut(change.bookIds.map((bookId, order) => ({ bookId, order })));
      return true;
    }
    const stored = await this.loadPreferences();
    const base = stored ?? defaultPreferences(false);
    const next = applyPreferenceChange(base, change);
    if (stored && deepEqual(stored, next)) {
      return false;
    }
    await this.db.preferences.put({ id: PREFERENCES_ID, ...next });
    return true;
  }

  private cardRow(lang: Lang, card: Card, keptSeq?: number): CardRow {
    const seq = keptSeq ?? this.nextCardSeq();
    const row: CardRow = {
      key: stateKey(lang, card.lemma),
      lang,
      lemma: card.lemma,
      sentenceId: card.sentenceId,
      seq,
    };
    if (card.schedule) {
      row.schedule = card.schedule;
    }
    return row;
  }

  private nextCardSeq(): number {
    const seq = this.cardSeq;
    this.cardSeq += 1;
    return seq;
  }
}
