import { type Lang, type WordState, stateKey } from "@glyphfern/core";
import type { Card, Preferences } from "../app/api";
import type { LanguageSnapshot, Repository, StoredBook } from "./repository";

interface StoredCard extends Card {
  lang: Lang;
}

export class MemoryRepository implements Repository {
  readonly kind = "memory" as const;
  private preferences: Preferences | undefined;
  private pins: string[] = [];
  private readonly seeded = new Set<Lang>();
  private readonly states = new Map<string, WordState>();
  private readonly cards = new Map<string, StoredCard>();
  private readonly bookmarks = new Map<Lang, number[]>();
  private readonly books = new Map<string, StoredBook>();

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

  async isSeeded(lang: Lang): Promise<boolean> {
    return this.seeded.has(lang);
  }

  async seedLanguage(lang: Lang, snapshot: LanguageSnapshot): Promise<void> {
    for (const [lemma, state] of Object.entries(snapshot.states)) {
      this.states.set(stateKey(lang, lemma), state);
    }
    for (const card of snapshot.cards) {
      this.cards.set(stateKey(lang, card.lemma), { ...card, lang });
    }
    this.bookmarks.set(lang, [...snapshot.bookmarks]);
    this.seeded.add(lang);
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
        cards.push({ lemma: card.lemma, sentenceId: card.sentenceId });
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
    const key = stateKey(lang, card.lemma);
    this.cards.delete(key);
    this.cards.set(key, { ...card, lang });
  }

  async deleteCard(lang: Lang, lemma: string): Promise<void> {
    this.cards.delete(stateKey(lang, lemma));
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
