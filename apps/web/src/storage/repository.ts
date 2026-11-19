import type { Lang, WordState } from "@glyphfern/core";
import type { Card, PersistenceKind, Preferences } from "../app/api";

export interface LanguageSnapshot {
  states: Record<string, WordState>;
  cards: Card[];
  bookmarks: number[];
}

export interface Repository {
  readonly kind: PersistenceKind;
  loadPreferences(): Promise<Preferences | undefined>;
  savePreferences(preferences: Preferences): Promise<void>;
  loadPins(): Promise<string[]>;
  savePins(pins: readonly string[]): Promise<void>;
  isSeeded(lang: Lang): Promise<boolean>;
  seedLanguage(lang: Lang, snapshot: LanguageSnapshot): Promise<void>;
  loadLanguage(lang: Lang): Promise<LanguageSnapshot>;
  saveWordState(lang: Lang, lemma: string, state: WordState): Promise<void>;
  saveCard(lang: Lang, card: Card): Promise<void>;
  deleteCard(lang: Lang, lemma: string): Promise<void>;
  saveBookmarks(lang: Lang, sentenceIds: readonly number[]): Promise<void>;
}
