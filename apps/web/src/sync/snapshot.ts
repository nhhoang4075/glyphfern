import type { Lang, ReviewLogEntry, WordState } from "@glyphfern/core";
import type { Card, Preferences } from "../app/api";
import {
  bookEntry,
  bookmarksRecord,
  cardRecord,
  pinsRecord,
  positionRecord,
  preferencesRecord,
  reviewRecord,
  wordStateRecord,
} from "./records";
import type { OutboxEntry } from "./types";

export const SNAPSHOT_UPDATED_AT = 1;

export interface LocalData {
  wordStates: { lang: Lang; lemma: string; state: WordState }[];
  cards: { lang: Lang; card: Card }[];
  reviews: { lang: Lang; entry: ReviewLogEntry }[];
  bookmarks: { lang: Lang; sentenceIds: number[] }[];
  pins: string[];
  preferences: Preferences | undefined;
}

export function buildSnapshot(
  data: LocalData,
  bookIds: readonly string[],
  uploadedBookIds: readonly string[],
): OutboxEntry[] {
  const at = SNAPSHOT_UPDATED_AT;
  const entries: OutboxEntry[] = [];
  for (const { lang, lemma, state } of data.wordStates) {
    entries.push(wordStateRecord(lang, lemma, state, at));
  }
  for (const { lang, card } of data.cards) {
    entries.push(cardRecord(lang, card, at));
  }
  for (const { lang, entry } of data.reviews) {
    entries.push(reviewRecord(lang, entry));
  }
  for (const { lang, sentenceIds } of data.bookmarks) {
    if (sentenceIds.length > 0) {
      entries.push(bookmarksRecord(lang, sentenceIds, at));
    }
  }
  if (data.pins.length > 0) {
    entries.push(pinsRecord(data.pins, at));
  }
  if (data.preferences) {
    entries.push(preferencesRecord(data.preferences, at));
    for (const [bookId, sentenceId] of Object.entries(data.preferences.positions)) {
      entries.push(positionRecord(bookId, sentenceId, at));
    }
  }
  for (const id of bookIds) {
    if (!uploadedBookIds.includes(id)) {
      entries.push(bookEntry(id, at, false));
    }
  }
  return entries;
}
