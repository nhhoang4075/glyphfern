export const RECORD_KINDS = [
  "wordState",
  "card",
  "review",
  "bookmarks",
  "pins",
  "preferences",
  "position",
] as const;

export type RecordKind = (typeof RECORD_KINDS)[number];

export type OutboxKind = RecordKind | "book";

export interface SyncRecord {
  kind: RecordKind;
  key: string;
  payload: unknown;
  updatedAt: number;
  deleted: boolean;
}

export interface PulledRecord extends SyncRecord {
  seq: number;
}

export interface OutboxEntry {
  id?: number;
  kind: OutboxKind;
  key: string;
  payload: unknown;
  updatedAt: number;
  deleted: boolean;
}

export interface PulledBook {
  id: string;
  lang: string;
  title: string;
  addedAt: number;
  seq: number;
  deleted: boolean;
  bytes: number;
}

export interface PullResponse {
  records: PulledRecord[];
  books: PulledBook[];
  cursor: number;
  more: boolean;
}

export interface PushResponse {
  accepted: number;
  cursor: number;
}

export interface BookUploadMeta {
  lang: string;
  title: string;
  addedAt: number;
}

export interface SyncState {
  cursor: number;
  lastSyncedAt: number;
  bookUploaded: string[];
  snapshotFor: string | null;
}

export function emptySyncState(): SyncState {
  return { cursor: 0, lastSyncedAt: 0, bookUploaded: [], snapshotFor: null };
}

export const SYNCED_PREFERENCE_KEYS = [
  "size",
  "lh",
  "font",
  "paper",
  "turn",
  "hl",
  "voice",
] as const;

export type SyncedPreferenceKey = (typeof SYNCED_PREFERENCE_KEYS)[number];
