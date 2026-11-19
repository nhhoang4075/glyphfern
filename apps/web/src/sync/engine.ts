import type { Repository } from "../storage/repository";
import { MAX_BATCH_RECORDS, splitBatches } from "./batches";
import { planBooks } from "./book-plan";
import { packBook, unpackBook } from "./gzip";
import { HttpError, type SyncApi } from "./http";
import { latestPerKey, toRecord } from "./merge";
import { buildSnapshot } from "./snapshot";
import {
  type OutboxEntry,
  type PulledBook,
  type SyncRecord,
  type SyncState,
  emptySyncState,
} from "./types";

export interface SyncDeps {
  repository: Repository;
  api: SyncApi;
  email: string;
  now: () => number;
}

export interface SyncOutcome {
  failed: boolean;
  changed: boolean;
}

const MAX_PULL_PAGES = 10_000;

function rethrowUnauthorized(error: unknown) {
  if (error instanceof HttpError && error.status === 401) {
    throw error;
  }
}

async function ensureSnapshot(deps: SyncDeps, loaded: SyncState): Promise<SyncState> {
  if (loaded.snapshotFor === deps.email) {
    return loaded;
  }
  if (loaded.snapshotFor !== null) {
    const pending = await deps.repository.readOutbox();
    await deps.repository.removeOutbox(pending.map((entry) => entry.id as number));
    const foreign: SyncState = { ...emptySyncState(), snapshotFor: deps.email };
    await deps.repository.saveSyncState(foreign);
    return foreign;
  }
  const state: SyncState = { ...loaded, snapshotFor: deps.email };
  const [data, books] = await Promise.all([
    deps.repository.exportLocal(),
    deps.repository.loadBooks(),
  ]);
  await deps.repository.appendOutbox(
    buildSnapshot(
      data,
      books.map((book) => book.id),
      state.bookUploaded,
    ),
  );
  await deps.repository.saveSyncState(state);
  return state;
}

function isRejected(error: unknown): boolean {
  return error instanceof HttpError && error.status === 400;
}

async function pushBatch(api: SyncApi, batch: readonly SyncRecord[]): Promise<void> {
  try {
    await api.push(batch);
  } catch (error) {
    if (!isRejected(error)) {
      throw error;
    }
    if (batch.length > 1) {
      for (const record of batch) {
        await pushBatch(api, [record]);
      }
    }
  }
}

async function pushRecords(deps: SyncDeps, entries: readonly OutboxEntry[]) {
  const records = entries.filter((entry) => entry.kind !== "book");
  const collapsed = latestPerKey(records).map(toRecord);
  for (const batch of splitBatches(collapsed, MAX_BATCH_RECORDS)) {
    await pushBatch(deps.api, batch);
  }
  await deps.repository.removeOutbox(records.map((entry) => entry.id as number));
}

async function syncBooksUp(
  deps: SyncDeps,
  entries: readonly OutboxEntry[],
  state: SyncState,
): Promise<{ state: SyncState; failed: boolean }> {
  const bookEntries = entries.filter((entry) => entry.kind === "book");
  const local = await deps.repository.loadBooks();
  let failed = false;
  const uploaded = new Set(state.bookUploaded);
  for (const entry of latestPerKey(bookEntries)) {
    const ids = bookEntries.filter((other) => other.key === entry.key).map((other) => other.id);
    try {
      if (entry.deleted) {
        await deps.api.deleteBook(entry.key);
        uploaded.delete(entry.key);
      } else {
        const stored = local.find((book) => book.id === entry.key);
        if (stored) {
          await deps.api.putBook(
            stored.id,
            { lang: stored.lang, title: stored.book.title, addedAt: stored.addedAt },
            packBook(stored),
          );
          uploaded.add(stored.id);
        }
      }
      await deps.repository.removeOutbox(ids as number[]);
    } catch (error) {
      rethrowUnauthorized(error);
      failed = true;
    }
  }
  return { state: { ...state, bookUploaded: [...uploaded] }, failed };
}

async function pullAll(
  deps: SyncDeps,
  start: SyncState,
): Promise<{ state: SyncState; books: PulledBook[]; changed: boolean }> {
  let state = start;
  const books: PulledBook[] = [];
  let changed = false;
  for (let page = 0; page < MAX_PULL_PAGES; page += 1) {
    const response = await deps.api.pull(state.cursor, MAX_BATCH_RECORDS);
    if (response.records.length > 0) {
      changed = (await deps.repository.applyRemote(response.records)) || changed;
    }
    books.push(...response.books);
    const advanced = response.cursor > state.cursor;
    state = { ...state, cursor: Math.max(state.cursor, response.cursor) };
    await deps.repository.saveSyncState(state);
    if (!response.more || !advanced) {
      break;
    }
  }
  return { state, books, changed };
}

async function syncBooksDown(
  deps: SyncDeps,
  metas: readonly PulledBook[],
  pendingDeletes: ReadonlySet<string>,
  state: SyncState,
): Promise<{ state: SyncState; failed: boolean; changed: boolean }> {
  const local = await deps.repository.loadBooks();
  const plan = planBooks(metas, local, pendingDeletes);
  const uploaded = new Set(state.bookUploaded);
  let failed = false;
  let changed = false;
  for (const id of plan.removeLocal) {
    await deps.repository.removeRemoteBook(id);
    uploaded.delete(id);
    changed = true;
  }
  for (const meta of plan.download) {
    try {
      const bytes = await deps.api.getBook(meta.id);
      const stored = bytes ? unpackBook(bytes) : null;
      if (stored && stored.id === meta.id) {
        await deps.repository.applyRemoteBook(stored);
        uploaded.add(stored.id);
        changed = true;
      }
    } catch (error) {
      rethrowUnauthorized(error);
      failed = true;
    }
  }
  return { state: { ...state, bookUploaded: [...uploaded] }, failed, changed };
}

export async function syncOnce(deps: SyncDeps): Promise<SyncOutcome> {
  let state = await ensureSnapshot(deps, await deps.repository.loadSyncState());
  const entries = await deps.repository.readOutbox();
  const pendingDeletes = new Set(
    entries.filter((entry) => entry.kind === "book" && entry.deleted).map((entry) => entry.key),
  );
  await pushRecords(deps, entries);
  const up = await syncBooksUp(deps, entries, state);
  state = up.state;
  const pulled = await pullAll(deps, state);
  const down = await syncBooksDown(deps, pulled.books, pendingDeletes, pulled.state);
  state = { ...down.state, lastSyncedAt: deps.now() };
  await deps.repository.saveSyncState(state);
  return { failed: up.failed || down.failed, changed: pulled.changed || down.changed };
}
