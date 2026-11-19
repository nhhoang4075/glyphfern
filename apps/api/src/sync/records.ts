export const MAX_PUSH_RECORDS = 500;
export const MAX_PUSH_BYTES = 1024 * 1024;
export const MAX_PAYLOAD_CHARS = 65536;
export const BOOK_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

const SYNC_LANGS = new Set(["es"]);
const MAX_LEMMA_CHARS = 100;
const MAX_SENTENCE_IDS = 5000;
const MAX_PINNED_BOOKS = 500;
const RATINGS = new Set(["again", "hard", "good", "easy"]);
const LINE_HEIGHTS = new Set([1.45, 1.62, 1.85]);
const FONTS = new Set(["serif", "sans"]);
const PAPERS = new Set(["#FCFBF9", "#F1EDE4", "#1B2420"]);
const TURNS = new Set(["slide", "curl", "still"]);
const VOICES = new Set(["system", "server"]);

export type RecordKind =
  | "wordState"
  | "card"
  | "review"
  | "bookmarks"
  | "pins"
  | "preferences"
  | "position";

export interface PushRecord {
  kind: RecordKind;
  key: string;
  payload: unknown;
  updatedAt: number;
  deleted: boolean;
}

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isLemma(value: string): boolean {
  return value.length > 0 && value.length <= MAX_LEMMA_CHARS;
}

function isLangLemmaKey(key: string): boolean {
  const split = key.indexOf(":");
  return split > 0 && SYNC_LANGS.has(key.slice(0, split)) && isLemma(key.slice(split + 1));
}

function isReviewKey(key: string): boolean {
  const first = key.indexOf(":");
  const second = key.indexOf(":", first + 1);
  if (first <= 0 || second < 0) {
    return false;
  }
  const reviewedAt = key.slice(first + 1, second);
  return (
    SYNC_LANGS.has(key.slice(0, first)) &&
    /^\d{1,16}$/.test(reviewedAt) &&
    isLemma(key.slice(second + 1))
  );
}

function isSchedule(value: unknown): boolean {
  if (!isObject(value)) {
    return false;
  }
  const numeric = [
    "due",
    "stability",
    "difficulty",
    "elapsedDays",
    "scheduledDays",
    "learningSteps",
    "reps",
    "lapses",
  ];
  return (
    numeric.every((field) => isNumber(value[field])) &&
    [0, 1, 2, 3].includes(value.state as number) &&
    (value.lastReview === null || isNumber(value.lastReview))
  );
}

function isWordState(value: unknown): boolean {
  if (!isObject(value)) {
    return false;
  }
  if (value.kind === "new" || value.kind === "known") {
    return true;
  }
  return value.kind === "learning" && [1, 2, 3].includes(value.level as number);
}

function isCard(value: unknown): boolean {
  return (
    isObject(value) &&
    typeof value.lemma === "string" &&
    isLemma(value.lemma) &&
    isInteger(value.sentenceId) &&
    (value.schedule === undefined || isSchedule(value.schedule))
  );
}

function isReview(value: unknown): boolean {
  return (
    isObject(value) &&
    typeof value.lemma === "string" &&
    isLemma(value.lemma) &&
    isInteger(value.sentenceId) &&
    RATINGS.has(value.rating as string) &&
    isInteger(value.reviewedAt) &&
    (value.before === null || isSchedule(value.before)) &&
    isSchedule(value.after) &&
    SYNC_LANGS.has(value.lang as string)
  );
}

function isBookmarks(value: unknown): boolean {
  return (
    isObject(value) &&
    Array.isArray(value.sentenceIds) &&
    value.sentenceIds.length <= MAX_SENTENCE_IDS &&
    value.sentenceIds.every(isInteger)
  );
}

function isPins(value: unknown): boolean {
  return (
    isObject(value) &&
    Array.isArray(value.bookIds) &&
    value.bookIds.length <= MAX_PINNED_BOOKS &&
    value.bookIds.every((id) => typeof id === "string" && BOOK_ID_PATTERN.test(id))
  );
}

function isPreferences(value: unknown): boolean {
  return (
    isObject(value) &&
    isNumber(value.size) &&
    LINE_HEIGHTS.has(value.lh as number) &&
    FONTS.has(value.font as string) &&
    PAPERS.has(value.paper as string) &&
    TURNS.has(value.turn as string) &&
    (value.hl === 0 || value.hl === 1) &&
    VOICES.has(value.voice as string)
  );
}

function isPosition(value: unknown): boolean {
  return isObject(value) && isInteger(value.sentenceId);
}

const KINDS: Record<
  RecordKind,
  { key: (key: string) => boolean; payload: (v: unknown) => boolean }
> = {
  wordState: { key: isLangLemmaKey, payload: isWordState },
  card: { key: isLangLemmaKey, payload: isCard },
  review: { key: isReviewKey, payload: isReview },
  bookmarks: { key: (key) => SYNC_LANGS.has(key), payload: isBookmarks },
  pins: { key: (key) => key === "all", payload: isPins },
  preferences: { key: (key) => key === "main", payload: isPreferences },
  position: { key: (key) => BOOK_ID_PATTERN.test(key), payload: isPosition },
};

export function isRecordKind(value: unknown): value is RecordKind {
  return typeof value === "string" && Object.hasOwn(KINDS, value);
}

export function parseRecord(value: unknown): PushRecord | undefined {
  if (!isObject(value) || !isRecordKind(value.kind)) {
    return undefined;
  }
  const rule = KINDS[value.kind];
  if (
    typeof value.key !== "string" ||
    !rule.key(value.key) ||
    !isInteger(value.updatedAt) ||
    typeof value.deleted !== "boolean"
  ) {
    return undefined;
  }
  if (value.deleted) {
    if (value.payload !== null || value.kind === "review") {
      return undefined;
    }
  } else if (
    !rule.payload(value.payload) ||
    JSON.stringify(value.payload).length > MAX_PAYLOAD_CHARS
  ) {
    return undefined;
  }
  return {
    kind: value.kind,
    key: value.key,
    payload: value.payload,
    updatedAt: value.updatedAt,
    deleted: value.deleted,
  };
}

export function parsePushBody(body: unknown): PushRecord[] | undefined {
  if (!isObject(body) || !Array.isArray(body.records) || body.records.length > MAX_PUSH_RECORDS) {
    return undefined;
  }
  const parsed: PushRecord[] = [];
  for (const raw of body.records) {
    const record = parseRecord(raw);
    if (!record) {
      return undefined;
    }
    parsed.push(record);
  }
  return parsed;
}

export function shouldReplace(storedUpdatedAt: number | undefined, incomingUpdatedAt: number) {
  return storedUpdatedAt === undefined || incomingUpdatedAt > storedUpdatedAt;
}
