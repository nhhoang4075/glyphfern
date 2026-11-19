import { expect, test } from "bun:test";
import { syncOnce } from "../../src/sync/engine";
import { HttpError, type SyncApi } from "../../src/sync/http";
import type { SyncRecord } from "../../src/sync/types";
import { openTestRepository } from "../../src/test-support";

const EMAIL = "owner@example.com";

test("a record the server rejects is dropped and the others are still pushed", async () => {
  const { repository } = await openTestRepository();
  const pushed: string[] = [];
  const api: SyncApi = {
    async push(records: readonly SyncRecord[]) {
      if (records.some((record) => record.key === "es:bad")) {
        throw new HttpError(400, "invalid_record");
      }
      pushed.push(...records.map((record) => record.key));
      return { accepted: records.length, cursor: 1 };
    },
    async pull() {
      return { records: [], books: [], cursor: 0, more: false };
    },
    async putBook() {},
    async getBook() {
      return null;
    },
    async deleteBook() {},
  };
  await repository.saveSyncState({
    cursor: 0,
    lastSyncedAt: 0,
    bookUploaded: [],
    snapshotFor: EMAIL,
  });
  await repository.appendOutbox([
    { kind: "wordState", key: "es:bad", payload: {}, updatedAt: 2, deleted: false },
    { kind: "wordState", key: "es:good", payload: { kind: "known" }, updatedAt: 3, deleted: false },
  ]);
  const outcome = await syncOnce({ repository, api, email: EMAIL, now: () => 10 });
  expect(outcome.failed).toBe(false);
  expect(pushed).toEqual(["es:good"]);
  expect(await repository.readOutbox()).toEqual([]);
});

test("signing in as a different account never uploads the previous account's data", async () => {
  const { repository } = await openTestRepository();
  const pushed: string[] = [];
  const api: SyncApi = {
    async push(records: readonly SyncRecord[]) {
      pushed.push(...records.map((record) => record.key));
      return { accepted: records.length, cursor: 1 };
    },
    async pull() {
      return { records: [], books: [], cursor: 0, more: false };
    },
    async putBook() {},
    async getBook() {
      return null;
    },
    async deleteBook() {},
  };
  await repository.saveSyncState({
    cursor: 7,
    lastSyncedAt: 1,
    bookUploaded: [],
    snapshotFor: "first@example.com",
  });
  await repository.saveWordState("es", "casa", { kind: "known" });
  await syncOnce({ repository, api, email: "second@example.com", now: () => 10 });
  expect(pushed).toEqual([]);
  const state = await repository.loadSyncState();
  expect(state.snapshotFor).toBe("second@example.com");
  expect(state.cursor).toBe(0);
});
