import { describe, expect, test } from "bun:test";
import { rateSchedule } from "@glyphfern/core";
import { defaultPreferences } from "../../src/app/defaults";
import { MemoryRepository } from "../../src/storage/memory-repository";
import type { Repository, StoredBook } from "../../src/storage/repository";
import type { PulledRecord } from "../../src/sync/types";
import { openTestRepository } from "../../src/test-support";

const FACTORIES: Array<[string, (now: () => number) => Promise<Repository>]> = [
  ["memory", async (now) => new MemoryRepository(now)],
  ["dexie", async (now) => (await openTestRepository(undefined, now)).repository],
];

function storedBook(id: string, addedAt: number, seq: number): StoredBook {
  return { id, lang: "es", seq, addedAt, book: { id, title: id, chapters: [] } as never };
}

async function summary(repository: Repository): Promise<string[]> {
  return (await repository.readOutbox()).map(
    (entry) => `${entry.kind}:${entry.key}:${entry.deleted ? "del" : "put"}`,
  );
}

for (const [name, create] of FACTORIES) {
  describe(`${name} repository outbox`, () => {
    test("every write appends the matching outbox entry", async () => {
      let clock = 1000;
      const repository = await create(() => clock);
      const after = rateSchedule(undefined, "good", 50);
      await repository.saveWordState("es", "lobo", { kind: "known" });
      await repository.saveWordState("es", "lobo", { kind: "new" });
      await repository.saveCard("es", { lemma: "lobo", sentenceId: 2 });
      await repository.deleteCard("es", "lobo");
      await repository.appendReview("es", {
        lemma: "lobo",
        sentenceId: 2,
        rating: "good",
        reviewedAt: 50,
        before: null,
        after,
      });
      await repository.saveBookmarks("es", [4]);
      await repository.savePins(["user-1"]);
      await repository.savePreferences({
        ...defaultPreferences(false),
        positions: { "user-1": 9 },
      });
      await repository.saveBook(storedBook("user-1", 1, 1000));
      await repository.deleteBook("user-1");
      expect(await summary(repository)).toEqual([
        "wordState:es:lobo:put",
        "wordState:es:lobo:del",
        "card:es:lobo:put",
        "card:es:lobo:del",
        "review:es:50:lobo:put",
        "bookmarks:es:put",
        "pins:all:put",
        "preferences:main:put",
        "position:user-1:put",
        "book:user-1:put",
        "book:user-1:del",
      ]);
      clock += 1;
    });

    test("timestamps are strictly increasing even on a frozen clock", async () => {
      const repository = await create(() => 5);
      await repository.saveBookmarks("es", [1]);
      await repository.saveBookmarks("es", [1, 2]);
      const stamps = (await repository.readOutbox()).map((entry) => entry.updatedAt);
      expect(stamps).toEqual([5, 6]);
    });

    test("saving unchanged preferences adds nothing; a changed position and a removed one do", async () => {
      const repository = await create(() => 10);
      const base = { ...defaultPreferences(false), positions: { a: 1 } };
      await repository.savePreferences(base);
      await repository.removeOutbox(
        (await repository.readOutbox()).map((entry) => entry.id as number),
      );
      await repository.savePreferences({ ...base, positions: { a: 1 } });
      expect(await summary(repository)).toEqual([]);
      await repository.savePreferences({ ...base, positions: { b: 2 } });
      expect(await summary(repository)).toEqual(["position:b:put", "position:a:del"]);
    });

    test("removeOutbox deletes only the given ids and sync state round-trips", async () => {
      const repository = await create(() => 10);
      await repository.saveBookmarks("es", [1]);
      await repository.saveBookmarks("es", [2]);
      const [first] = await repository.readOutbox();
      await repository.removeOutbox([first?.id as number]);
      expect(await repository.readOutbox()).toHaveLength(1);
      expect(await repository.loadSyncState()).toEqual({
        cursor: 0,
        lastSyncedAt: 0,
        bookUploaded: [],
        snapshotFor: null,
      });
      await repository.saveSyncState({
        cursor: 7,
        lastSyncedAt: 9,
        bookUploaded: ["x"],
        snapshotFor: "me@example.com",
      });
      expect((await repository.loadSyncState()).cursor).toBe(7);
    });

    test("books are listed by addedAt, not by slot", async () => {
      const repository = await create(() => 10);
      await repository.saveBook(storedBook("late", 20, 5));
      await repository.saveBook(storedBook("early", 10, 900_000));
      expect((await repository.loadBooks()).map((book) => book.id)).toEqual(["early", "late"]);
    });

    test("applying a remote record writes it without an outbox entry", async () => {
      const repository = await create(() => 10);
      const changed = await repository.applyRemote([
        remote("wordState", "es:lobo", { kind: "known" }, 5, 1),
        remote("bookmarks", "es", { sentenceIds: [3] }, 5, 2),
      ]);
      expect(changed).toBe(true);
      const snapshot = await repository.loadLanguage("es");
      expect(snapshot.states).toEqual({ lobo: { kind: "known" } });
      expect(snapshot.bookmarks).toEqual([3]);
      expect(await repository.readOutbox()).toEqual([]);
    });

    test("an echo of the same data reports no change", async () => {
      const repository = await create(() => 10);
      const records = [remote("wordState", "es:lobo", { kind: "known" }, 5, 1)];
      await repository.applyRemote(records);
      expect(await repository.applyRemote(records)).toBe(false);
    });

    test("a pending local write newer than the remote record wins and stays queued", async () => {
      const repository = await create(() => 100);
      await repository.saveWordState("es", "lobo", { kind: "learning", level: 3 });
      const changed = await repository.applyRemote([
        remote("wordState", "es:lobo", { kind: "known" }, 50, 1),
      ]);
      expect(changed).toBe(false);
      expect((await repository.loadLanguage("es")).states.lobo).toEqual({
        kind: "learning",
        level: 3,
      });
      expect(await summary(repository)).toEqual(["wordState:es:lobo:put"]);
    });

    test("a newer remote record replaces the pending local write and drops it from the outbox", async () => {
      const repository = await create(() => 100);
      await repository.saveWordState("es", "lobo", { kind: "learning", level: 3 });
      await repository.applyRemote([remote("wordState", "es:lobo", { kind: "known" }, 500, 1)]);
      expect((await repository.loadLanguage("es")).states.lobo).toEqual({ kind: "known" });
      expect(await summary(repository)).toEqual([]);
    });

    test("a tie goes to the remote copy", async () => {
      const repository = await create(() => 100);
      await repository.saveWordState("es", "lobo", { kind: "learning", level: 3 });
      await repository.applyRemote([remote("wordState", "es:lobo", { kind: "known" }, 100, 1)]);
      expect((await repository.loadLanguage("es")).states.lobo).toEqual({ kind: "known" });
    });

    test("a remote review is added once and never replaced", async () => {
      const repository = await create(() => 100);
      const after = rateSchedule(undefined, "good", 50);
      const payload = {
        lang: "es",
        lemma: "lobo",
        sentenceId: 2,
        rating: "good",
        reviewedAt: 50,
        before: null,
        after,
      };
      const record = remote("review", "es:50:lobo", payload, 50, 1);
      expect(await repository.applyRemote([record])).toBe(true);
      expect(await repository.applyRemote([{ ...record, seq: 2 }])).toBe(false);
      expect(await repository.loadReviewLog("es")).toHaveLength(1);
    });

    test("remote preferences and positions merge into the stored preferences", async () => {
      const repository = await create(() => 100);
      await repository.savePreferences({
        ...defaultPreferences(false),
        lang: "es",
        bookId: "user-1",
        positions: { "user-1": 1 },
      });
      await repository.applyRemote([
        remote("preferences", "main", { ...pickSynced(), size: 27 }, 500, 1),
        remote("position", "user-1", { sentenceId: 88 }, 500, 2),
      ]);
      const preferences = await repository.loadPreferences();
      expect(preferences?.size).toBe(27);
      expect(preferences?.bookId).toBe("user-1");
      expect(preferences?.positions).toEqual({ "user-1": 88 });
    });
  });
}

function pickSynced() {
  const { size, lh, font, paper, turn, hl, voice } = defaultPreferences(false);
  return { size, lh, font, paper, turn, hl, voice };
}

function remote(
  kind: PulledRecord["kind"],
  key: string,
  payload: unknown,
  updatedAt: number,
  seq: number,
): PulledRecord {
  return { kind, key, payload, updatedAt, deleted: false, seq };
}
