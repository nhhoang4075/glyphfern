import { describe, expect, test } from "bun:test";
import { rateSchedule } from "@glyphfern/core";
import Dexie from "dexie";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { DexieRepository, GlyphfernDatabase } from "../../src/storage/dexie-repository";
import { uniqueDatabaseName } from "../../src/test-support";

const NOON = new Date(2026, 5, 10, 12, 0, 0).getTime();

async function createVersion2Database(name: string) {
  const legacy = new Dexie(name, { indexedDB, IDBKeyRange });
  legacy.version(1).stores({
    wordStates: "key, lang",
    cards: "key, lang",
    bookmarks: "lang",
    pins: "bookId, order",
    preferences: "id",
    meta: "key",
  });
  legacy.version(2).stores({ books: "id, lang" });
  await legacy.open();
  await legacy.table("wordStates").put({
    key: "es:leña",
    lang: "es",
    lemma: "leña",
    state: { kind: "learning", level: 3 },
  });
  await legacy.table("cards").put({
    key: "es:leña",
    lang: "es",
    lemma: "leña",
    sentenceId: 2,
    seq: 0,
  });
  await legacy.table("bookmarks").put({ lang: "es", sentenceIds: [5] });
  await legacy.table("pins").put({ bookId: "platero-y-yo", order: 0 });
  await legacy.table("meta").put({ key: "seeded:es", value: true });
  await legacy.table("books").put({ id: "user-1", lang: "es", seq: 1, addedAt: 1, book: {} });
  legacy.close();
}

describe("opening a version 2 database with the current schema", () => {
  test("keeps every stored row and adds an empty review log", async () => {
    const name = uniqueDatabaseName();
    await createVersion2Database(name);

    const database = new GlyphfernDatabase(name, { indexedDB, IDBKeyRange });
    await database.open();
    const repository = new DexieRepository(database);

    expect(database.tables.map((table) => table.name).sort()).toEqual([
      "bookmarks",
      "books",
      "cards",
      "meta",
      "outbox",
      "pins",
      "preferences",
      "reviewLog",
      "syncState",
      "wordStates",
    ]);
    const snapshot = await repository.loadLanguage("es");
    expect(snapshot.states).toEqual({ leña: { kind: "learning", level: 3 } });
    expect(snapshot.cards).toEqual([{ lemma: "leña", sentenceId: 2 }]);
    expect(snapshot.bookmarks).toEqual([5]);
    expect(await repository.loadPins()).toEqual(["platero-y-yo"]);
    expect((await repository.loadBooks()).map((book) => book.id)).toEqual(["user-1"]);
    expect(await repository.loadReviewLog("es")).toEqual([]);
  });

  test("the review log accepts entries and a legacy card can be given a schedule", async () => {
    const name = uniqueDatabaseName();
    await createVersion2Database(name);
    const database = new GlyphfernDatabase(name, { indexedDB, IDBKeyRange });
    await database.open();
    const repository = new DexieRepository(database);

    const after = rateSchedule(undefined, "good", NOON);
    await repository.saveCard("es", { lemma: "leña", sentenceId: 2, schedule: after });
    await repository.appendReview("es", {
      lemma: "leña",
      sentenceId: 2,
      rating: "good",
      reviewedAt: NOON,
      before: null,
      after,
    });

    const snapshot = await repository.loadLanguage("es");
    expect(snapshot.cards).toEqual([{ lemma: "leña", sentenceId: 2, schedule: after }]);
    expect(await repository.countNewReviewsSince("es", NOON)).toBe(1);
    expect(await repository.loadReviewLog("es")).toHaveLength(1);
  });
});

describe("opening a version 3 database with the current schema", () => {
  async function createVersion3Database(name: string) {
    const legacy = new Dexie(name, { indexedDB, IDBKeyRange });
    legacy.version(1).stores({
      wordStates: "key, lang",
      cards: "key, lang",
      bookmarks: "lang",
      pins: "bookId, order",
      preferences: "id",
      meta: "key",
    });
    legacy.version(2).stores({ books: "id, lang" });
    legacy.version(3).stores({ reviewLog: "++id, lang, reviewedAt, [lang+reviewedAt]" });
    await legacy.open();
    await legacy.table("wordStates").put({
      key: "es:leña",
      lang: "es",
      lemma: "leña",
      state: { kind: "known" },
    });
    await legacy.table("cards").put({
      key: "es:leña",
      lang: "es",
      lemma: "leña",
      sentenceId: 2,
      seq: 0,
    });
    await legacy.table("books").put({ id: "user-1", lang: "es", seq: 1, addedAt: 1, book: {} });
    await legacy.table("reviewLog").add({
      lang: "es",
      lemma: "leña",
      sentenceId: 2,
      rating: "good",
      reviewedAt: NOON,
      before: null,
      after: rateSchedule(undefined, "good", NOON),
    });
    legacy.close();
  }

  test("keeps every row, starts with an empty outbox and sync state, and queues new writes", async () => {
    const name = uniqueDatabaseName();
    await createVersion3Database(name);
    const database = new GlyphfernDatabase(name, { indexedDB, IDBKeyRange });
    await database.open();
    const repository = new DexieRepository(database, () => NOON);

    const snapshot = await repository.loadLanguage("es");
    expect(snapshot.states).toEqual({ leña: { kind: "known" } });
    expect(snapshot.cards).toEqual([{ lemma: "leña", sentenceId: 2 }]);
    expect((await repository.loadBooks()).map((book) => book.id)).toEqual(["user-1"]);
    expect(await repository.loadReviewLog("es")).toHaveLength(1);
    expect(await repository.readOutbox()).toEqual([]);
    expect((await repository.loadSyncState()).cursor).toBe(0);

    await repository.saveWordState("es", "leña", { kind: "learning", level: 3 });
    const outbox = await repository.readOutbox();
    expect(outbox.map((entry) => `${entry.kind}:${entry.key}`)).toEqual(["wordState:es:leña"]);
    expect(outbox[0]?.updatedAt).toBe(NOON);
  });
});
