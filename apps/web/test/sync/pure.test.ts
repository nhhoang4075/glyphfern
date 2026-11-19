import { describe, expect, test } from "bun:test";
import { rateSchedule } from "@glyphfern/core";
import { defaultPreferences } from "../../src/app/defaults";
import { splitBatches } from "../../src/sync/batches";
import { planBooks } from "../../src/sync/book-plan";
import { deepEqual } from "../../src/sync/equal";
import { latestPerKey, mergeRecord } from "../../src/sync/merge";
import {
  decodeRecord,
  preferenceRecords,
  reviewRecord,
  wordStateRecord,
} from "../../src/sync/records";
import { SNAPSHOT_UPDATED_AT, buildSnapshot } from "../../src/sync/snapshot";
import { createStamper } from "../../src/sync/stamp";
import type { OutboxEntry, SyncRecord } from "../../src/sync/types";

function record(
  key: string,
  updatedAt: number,
  kind: SyncRecord["kind"] = "wordState",
): SyncRecord {
  return { kind, key, payload: { kind: "known" }, updatedAt, deleted: false };
}

describe("merge", () => {
  test("last write wins and a tie goes to the remote (server) copy", () => {
    expect(mergeRecord(record("a", 5), record("a", 6))).toBe("remote");
    expect(mergeRecord(record("a", 5), record("a", 4))).toBe("local");
    expect(mergeRecord(record("a", 5), record("a", 5))).toBe("remote");
    expect(mergeRecord(undefined, record("a", 1))).toBe("remote");
  });

  test("a review is append-only: the first write stays", () => {
    expect(mergeRecord(record("r", 9, "review"), record("r", 10, "review"))).toBe("local");
    expect(mergeRecord(undefined, record("r", 10, "review"))).toBe("remote");
  });

  test("latestPerKey keeps the newest entry per key and the first review", () => {
    const entries: OutboxEntry[] = [
      { ...record("a", 1), id: 1 },
      { ...record("a", 3), id: 2 },
      { ...record("a", 2), id: 3 },
      { ...record("r", 5, "review"), id: 4 },
      { ...record("r", 9, "review"), id: 5 },
    ];
    const chosen = latestPerKey(entries);
    expect(chosen.map((entry) => entry.id)).toEqual([2, 4]);
  });
});

describe("outbox records", () => {
  test("a word state becoming new is a tombstone with a null payload", () => {
    expect(wordStateRecord("es", "lobo", { kind: "new" }, 7)).toEqual({
      kind: "wordState",
      key: "es:lobo",
      payload: null,
      updatedAt: 7,
      deleted: true,
    });
  });

  test("preference records cover changed fields and changed or removed positions only", () => {
    const base = { ...defaultPreferences(false), positions: { a: 1, b: 2 } };
    expect(preferenceRecords(base, { ...base }, 5)).toEqual([]);
    const next = { ...base, size: 25, positions: { a: 1, c: 3 } };
    const records = preferenceRecords(base, next, 5);
    expect(records.map((entry) => `${entry.kind}:${entry.key}:${entry.deleted}`)).toEqual([
      "preferences:main:false",
      "position:c:false",
      "position:b:true",
    ]);
    expect(records[0]?.payload).toMatchObject({ size: 25, voice: "system" });
  });

  test("a review record carries the language and is keyed by language, time and lemma", () => {
    const after = rateSchedule(undefined, "good", 100);
    const entry = reviewRecord("es", {
      lemma: "lobo",
      sentenceId: 3,
      rating: "good",
      reviewedAt: 100,
      before: null,
      after,
    });
    expect(entry.key).toBe("es:100:lobo");
    expect(decodeRecord(entry)).toMatchObject({ type: "review", lang: "es" });
  });

  test("decoding rejects malformed payloads and understands tombstones", () => {
    expect(decodeRecord({ ...record("nocolon", 1) })).toBeNull();
    expect(
      decodeRecord({ kind: "card", key: "es:a", payload: null, updatedAt: 1, deleted: true }),
    ).toEqual({ type: "card", lang: "es", lemma: "a", card: null });
    expect(
      decodeRecord({ kind: "position", key: "u-1", payload: null, updatedAt: 1, deleted: true }),
    ).toEqual({ type: "position", bookId: "u-1", sentenceId: null });
  });
});

describe("snapshot", () => {
  test("enqueues every local record at the snapshot time and every book not uploaded", () => {
    const preferences = { ...defaultPreferences(false), positions: { "user-1": 4 } };
    const entries = buildSnapshot(
      {
        wordStates: [{ lang: "es", lemma: "lobo", state: { kind: "known" } }],
        cards: [{ lang: "es", card: { lemma: "lobo", sentenceId: 2 } }],
        reviews: [],
        bookmarks: [
          { lang: "es", sentenceIds: [1] },
          { lang: "es", sentenceIds: [] },
        ],
        pins: ["user-1"],
        preferences,
      },
      ["user-1", "user-2"],
      ["user-1"],
    );
    expect(entries.map((entry) => `${entry.kind}:${entry.key}`)).toEqual([
      "wordState:es:lobo",
      "card:es:lobo",
      "bookmarks:es",
      "pins:all",
      "preferences:main",
      "position:user-1",
      "book:user-2",
    ]);
    expect(entries.every((entry) => entry.updatedAt === SNAPSHOT_UPDATED_AT)).toBe(true);
  });
});

describe("batches", () => {
  test("splits by record count and by bytes", () => {
    const records = Array.from({ length: 1201 }, (_, index) => record(`k${index}`, index));
    expect(splitBatches(records).map((batch) => batch.length)).toEqual([500, 500, 201]);
    const big = [record("a", 1), record("b", 2), record("c", 3)];
    expect(splitBatches(big, 500, 130).map((batch) => batch.length)).toEqual([1, 1, 1]);
  });
});

describe("book plan", () => {
  const meta = (id: string, seq: number, deleted: boolean) => ({
    id,
    lang: "es",
    title: id,
    addedAt: 10,
    seq,
    deleted,
    bytes: 1,
  });

  test("downloads unknown books, deletes by tombstone, skips books deleted locally", () => {
    const plan = planBooks(
      [
        meta("new", 1, false),
        meta("gone", 2, true),
        meta("mine", 3, false),
        meta("old", 4, false),
        meta("old", 5, true),
      ],
      [
        { id: "gone", addedAt: 10 },
        { id: "mine", addedAt: 10 },
        { id: "old", addedAt: 10 },
      ],
      new Set(["mine"]),
    );
    expect(plan.download.map((entry) => entry.id)).toEqual(["new"]);
    expect(plan.removeLocal.sort()).toEqual(["gone", "old"]);
  });
});

describe("helpers", () => {
  test("deepEqual ignores key order and undefined fields", () => {
    expect(deepEqual({ a: 1, b: { c: [1, 2] } }, { b: { c: [1, 2] }, a: 1, d: undefined })).toBe(
      true,
    );
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
  });

  test("the stamper never repeats a timestamp", () => {
    const stamp = createStamper(() => 100);
    expect([stamp(), stamp(), stamp()]).toEqual([100, 101, 102]);
  });
});
