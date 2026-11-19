import {
  type CardSchedule,
  type Lang,
  type ReviewLogEntry,
  type WordState,
  stateKey,
} from "@glyphfern/core";
import Dexie, { type DexieOptions, type Table } from "dexie";
import type { Card, Preferences } from "../app/api";
import type { LanguageSnapshot, Repository, StoredBook } from "./repository";
import { isFirstReview } from "./review-log";

export const DATABASE_NAME = "glyphfern";
const PREFERENCES_ID = "main";

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

export class GlyphfernDatabase extends Dexie {
  readonly wordStates: Table<WordStateRow, string>;
  readonly cards: Table<CardRow, string>;
  readonly bookmarks: Table<BookmarkRow, Lang>;
  readonly pins: Table<PinRow, string>;
  readonly preferences: Table<PreferencesRow, string>;
  readonly meta: Table<MetaRow, string>;
  readonly books: Table<StoredBook, string>;
  readonly reviewLog: Table<ReviewLogRow, number>;

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
    this.reviewLog = this.table("reviewLog");
    this.books = this.table("books");
    this.wordStates = this.table("wordStates");
    this.cards = this.table("cards");
    this.bookmarks = this.table("bookmarks");
    this.pins = this.table("pins");
    this.preferences = this.table("preferences");
    this.meta = this.table("meta");
  }
}

export class DexieRepository implements Repository {
  readonly kind = "indexeddb" as const;
  private cardSeq = 0;

  constructor(private readonly db: GlyphfernDatabase) {}

  async loadPreferences(): Promise<Preferences | undefined> {
    const row = await this.db.preferences.get(PREFERENCES_ID);
    if (!row) {
      return undefined;
    }
    const { id: _id, ...preferences } = row;
    return preferences;
  }

  async savePreferences(preferences: Preferences): Promise<void> {
    await this.db.preferences.put({ id: PREFERENCES_ID, ...preferences });
  }

  async loadPins(): Promise<string[]> {
    const rows = await this.db.pins.orderBy("order").toArray();
    return rows.map((row) => row.bookId);
  }

  async savePins(pins: readonly string[]): Promise<void> {
    await this.db.transaction("rw", this.db.pins, async () => {
      await this.db.pins.clear();
      await this.db.pins.bulkPut(pins.map((bookId, order) => ({ bookId, order })));
    });
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
    if (state.kind === "new") {
      await this.db.wordStates.delete(key);
      return;
    }
    await this.db.wordStates.put({ key, lang, lemma, state });
  }

  async saveCard(lang: Lang, card: Card): Promise<void> {
    const existing = await this.db.cards.get(stateKey(lang, card.lemma));
    await this.db.cards.put(this.cardRow(lang, card, existing?.seq));
  }

  async deleteCard(lang: Lang, lemma: string): Promise<void> {
    await this.db.cards.delete(stateKey(lang, lemma));
  }

  async appendReview(lang: Lang, entry: ReviewLogEntry): Promise<void> {
    await this.db.reviewLog.add({ ...entry, lang });
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
    await this.db.bookmarks.put({ lang, sentenceIds: [...sentenceIds] });
  }

  async loadBooks(): Promise<StoredBook[]> {
    const rows = await this.db.books.toArray();
    return rows.sort((a, b) => a.seq - b.seq);
  }

  async saveBook(book: StoredBook): Promise<void> {
    await this.db.books.put(book);
  }

  async deleteBook(id: string): Promise<void> {
    await this.db.books.delete(id);
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
