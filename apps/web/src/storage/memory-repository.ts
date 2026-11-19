import { type Lang, type ReviewLogEntry, type WordState, stateKey } from "@glyphfern/core";
import type { Card, Preferences } from "../app/api";
import type { LanguageSnapshot, Repository, StoredBook } from "./repository";
import { isFirstReview } from "./review-log";

interface StoredCard extends Card {
  lang: Lang;
}

interface StoredReview {
  lang: Lang;
  entry: ReviewLogEntry;
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

  async loadPreferences(): Promise<Preferences | undefined> {
    return this.preferences ? { ...this.preferences } : undefined;
  }

  async savePreferences(preferences: Preferences): Promise<void> {
    this.preferences = { ...preferences };
  }

  async loadPins(): Promise<string[]> {
    return [...this.pins];
  }

  async savePins(pins: readonly string[]): Promise<void> {
    this.pins = [...pins];
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
      return;
    }
    this.states.set(key, state);
  }

  async saveCard(lang: Lang, card: Card): Promise<void> {
    this.cards.set(stateKey(lang, card.lemma), { ...structuredClone(card), lang });
  }

  async deleteCard(lang: Lang, lemma: string): Promise<void> {
    this.cards.delete(stateKey(lang, lemma));
  }

  async appendReview(lang: Lang, entry: ReviewLogEntry): Promise<void> {
    this.reviewLog.push({ lang, entry: structuredClone(entry) });
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
  }

  async loadBooks(): Promise<StoredBook[]> {
    return [...this.books.values()].sort((a, b) => a.seq - b.seq);
  }

  async saveBook(book: StoredBook): Promise<void> {
    this.books.set(book.id, book);
  }

  async deleteBook(id: string): Promise<void> {
    this.books.delete(id);
  }
}
