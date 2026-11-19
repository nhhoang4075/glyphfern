import { type Lang, type WordState, stateKey } from "@glyphfern/core";
import Dexie, { type DexieOptions, type Table } from "dexie";
import type { Card, Preferences } from "../app/api";
import type { LanguageSnapshot, Repository, StoredBook } from "./repository";

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
    this.books = this.table("books");
    this.wordStates = this.table("wordStates");
    this.cards = this.table("cards");
    this.bookmarks = this.table("bookmarks");
    this.pins = this.table("pins");
    this.preferences = this.table("preferences");
    this.meta = this.table("meta");
  }
}

function seededKey(lang: Lang): string {
  return `seeded:${lang}`;
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

  async isSeeded(lang: Lang): Promise<boolean> {
    const row = await this.db.meta.get(seededKey(lang));
    return row?.value === true;
  }

  async seedLanguage(lang: Lang, snapshot: LanguageSnapshot): Promise<void> {
    const stateRows: WordStateRow[] = Object.entries(snapshot.states).map(([lemma, state]) => ({
      key: stateKey(lang, lemma),
      lang,
      lemma,
      state,
    }));
    const cardRows: CardRow[] = snapshot.cards.map((card) => this.cardRow(lang, card));
    await this.db.transaction(
      "rw",
      [this.db.wordStates, this.db.cards, this.db.bookmarks, this.db.meta],
      async () => {
        await this.db.wordStates.bulkPut(stateRows);
        await this.db.cards.bulkPut(cardRows);
        await this.db.bookmarks.put({ lang, sentenceIds: [...snapshot.bookmarks] });
        await this.db.meta.put({ key: seededKey(lang), value: true });
      },
    );
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
      .map((row) => ({ lemma: row.lemma, sentenceId: row.sentenceId }));
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
    await this.db.cards.put(this.cardRow(lang, card));
  }

  async deleteCard(lang: Lang, lemma: string): Promise<void> {
    await this.db.cards.delete(stateKey(lang, lemma));
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

  private cardRow(lang: Lang, card: Card): CardRow {
    const seq = this.cardSeq;
    this.cardSeq += 1;
    return {
      key: stateKey(lang, card.lemma),
      lang,
      lemma: card.lemma,
      sentenceId: card.sentenceId,
      seq,
    };
  }
}
