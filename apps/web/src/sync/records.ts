import {
  type CardSchedule,
  type Lang,
  type ReviewLogEntry,
  type WordState,
  stateKey,
} from "@glyphfern/core";
import type { Card, Preferences } from "../app/api";
import {
  type OutboxEntry,
  SYNCED_PREFERENCE_KEYS,
  type SyncRecord,
  type SyncedPreferenceKey,
} from "./types";

export const PINS_KEY = "all";
export const PREFERENCES_KEY = "main";

export type PreferenceFields = Pick<Preferences, SyncedPreferenceKey>;

export type RemoteChange =
  | { type: "wordState"; lang: Lang; lemma: string; state: WordState | null }
  | { type: "card"; lang: Lang; lemma: string; card: Card | null }
  | { type: "review"; lang: Lang; entry: ReviewLogEntry }
  | { type: "bookmarks"; lang: Lang; sentenceIds: number[] }
  | { type: "pins"; bookIds: string[] }
  | { type: "preferences"; fields: PreferenceFields }
  | { type: "position"; bookId: string; sentenceId: number | null };

export function reviewKey(lang: Lang, reviewedAt: number, lemma: string): string {
  return `${lang}:${reviewedAt}:${lemma}`;
}

export function wordStateRecord(
  lang: Lang,
  lemma: string,
  state: WordState,
  updatedAt: number,
): SyncRecord {
  const key = stateKey(lang, lemma);
  if (state.kind === "new") {
    return { kind: "wordState", key, payload: null, updatedAt, deleted: true };
  }
  return { kind: "wordState", key, payload: state, updatedAt, deleted: false };
}

export function cardRecord(lang: Lang, card: Card, updatedAt: number): SyncRecord {
  const payload: { lemma: string; sentenceId: number; schedule?: CardSchedule } = {
    lemma: card.lemma,
    sentenceId: card.sentenceId,
  };
  if (card.schedule) {
    payload.schedule = card.schedule;
  }
  return { kind: "card", key: stateKey(lang, card.lemma), payload, updatedAt, deleted: false };
}

export function cardTombstone(lang: Lang, lemma: string, updatedAt: number): SyncRecord {
  return { kind: "card", key: stateKey(lang, lemma), payload: null, updatedAt, deleted: true };
}

export function reviewRecord(lang: Lang, entry: ReviewLogEntry): SyncRecord {
  return {
    kind: "review",
    key: reviewKey(lang, entry.reviewedAt, entry.lemma),
    payload: { ...entry, lang },
    updatedAt: entry.reviewedAt,
    deleted: false,
  };
}

export function bookmarksRecord(
  lang: Lang,
  sentenceIds: readonly number[],
  updatedAt: number,
): SyncRecord {
  return {
    kind: "bookmarks",
    key: lang,
    payload: { sentenceIds: [...sentenceIds] },
    updatedAt,
    deleted: false,
  };
}

export function pinsRecord(bookIds: readonly string[], updatedAt: number): SyncRecord {
  return {
    kind: "pins",
    key: PINS_KEY,
    payload: { bookIds: [...bookIds] },
    updatedAt,
    deleted: false,
  };
}

export function preferenceFields(preferences: Preferences): PreferenceFields {
  return {
    size: preferences.size,
    lh: preferences.lh,
    font: preferences.font,
    paper: preferences.paper,
    turn: preferences.turn,
    hl: preferences.hl,
    voice: preferences.voice,
  };
}

export function preferencesRecord(preferences: Preferences, updatedAt: number): SyncRecord {
  return {
    kind: "preferences",
    key: PREFERENCES_KEY,
    payload: preferenceFields(preferences),
    updatedAt,
    deleted: false,
  };
}

export function positionRecord(
  bookId: string,
  sentenceId: number | null,
  updatedAt: number,
): SyncRecord {
  if (sentenceId === null) {
    return { kind: "position", key: bookId, payload: null, updatedAt, deleted: true };
  }
  return { kind: "position", key: bookId, payload: { sentenceId }, updatedAt, deleted: false };
}

export function bookEntry(id: string, updatedAt: number, deleted: boolean): OutboxEntry {
  return { kind: "book", key: id, payload: null, updatedAt, deleted };
}

export function preferenceRecords(
  previous: Preferences | undefined,
  next: Preferences,
  updatedAt: number,
): SyncRecord[] {
  const records: SyncRecord[] = [];
  const fieldsChanged =
    !previous || SYNCED_PREFERENCE_KEYS.some((key) => previous[key] !== next[key]);
  if (fieldsChanged) {
    records.push(preferencesRecord(next, updatedAt));
  }
  const before = previous?.positions ?? {};
  for (const [bookId, sentenceId] of Object.entries(next.positions ?? {})) {
    if (before[bookId] !== sentenceId) {
      records.push(positionRecord(bookId, sentenceId, updatedAt));
    }
  }
  for (const bookId of Object.keys(before)) {
    if (!(bookId in (next.positions ?? {}))) {
      records.push(positionRecord(bookId, null, updatedAt));
    }
  }
  return records;
}

export function applyPreferenceChange(base: Preferences, change: RemoteChange): Preferences {
  if (change.type === "preferences") {
    return { ...base, ...change.fields, positions: { ...base.positions } };
  }
  if (change.type === "position") {
    const positions = { ...base.positions };
    if (change.sentenceId === null) {
      delete positions[change.bookId];
    } else {
      positions[change.bookId] = change.sentenceId;
    }
    return { ...base, positions };
  }
  return base;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function splitLangKey(key: string): { lang: Lang; rest: string } | null {
  const index = key.indexOf(":");
  if (index <= 0) {
    return null;
  }
  return { lang: key.slice(0, index) as Lang, rest: key.slice(index + 1) };
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === "number");
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function decodeRecord(record: SyncRecord): RemoteChange | null {
  const { kind, key, payload, deleted } = record;
  if (kind === "wordState") {
    const parts = splitLangKey(key);
    if (!parts) {
      return null;
    }
    if (deleted || payload === null) {
      return { type: "wordState", lang: parts.lang, lemma: parts.rest, state: null };
    }
    return isObject(payload)
      ? { type: "wordState", lang: parts.lang, lemma: parts.rest, state: payload as WordState }
      : null;
  }
  if (kind === "card") {
    const parts = splitLangKey(key);
    if (!parts) {
      return null;
    }
    if (deleted || payload === null) {
      return { type: "card", lang: parts.lang, lemma: parts.rest, card: null };
    }
    if (!isObject(payload) || typeof payload.sentenceId !== "number") {
      return null;
    }
    const card: Card = { lemma: parts.rest, sentenceId: payload.sentenceId };
    if (isObject(payload.schedule)) {
      card.schedule = payload.schedule as unknown as CardSchedule;
    }
    return { type: "card", lang: parts.lang, lemma: parts.rest, card };
  }
  if (kind === "review") {
    if (!isObject(payload) || typeof payload.lang !== "string") {
      return null;
    }
    const { lang, ...entry } = payload;
    return { type: "review", lang: lang as Lang, entry: entry as unknown as ReviewLogEntry };
  }
  if (kind === "bookmarks") {
    const ids = isObject(payload) ? payload.sentenceIds : [];
    return { type: "bookmarks", lang: key as Lang, sentenceIds: isNumberArray(ids) ? ids : [] };
  }
  if (kind === "pins") {
    const ids = isObject(payload) ? payload.bookIds : [];
    return { type: "pins", bookIds: isStringArray(ids) ? ids : [] };
  }
  if (kind === "preferences") {
    return isObject(payload) && !deleted
      ? { type: "preferences", fields: payload as unknown as PreferenceFields }
      : null;
  }
  if (kind === "position") {
    if (deleted || payload === null) {
      return { type: "position", bookId: key, sentenceId: null };
    }
    return isObject(payload) && typeof payload.sentenceId === "number"
      ? { type: "position", bookId: key, sentenceId: payload.sentenceId }
      : null;
  }
  return null;
}
