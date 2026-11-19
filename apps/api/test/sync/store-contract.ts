import { describe, expect, test } from "bun:test";
import type { PushRecord } from "../../src/sync/records";
import type { SyncStore } from "../../src/sync/sync-store";

export interface StoreFixture {
  store: SyncStore;
  newUser(): Promise<string>;
}

export function position(key: string, updatedAt: number, sentenceId: number): PushRecord {
  return { kind: "position", key, payload: { sentenceId }, updatedAt, deleted: false };
}

export function review(key: string, sentenceId: number): PushRecord {
  const schedule = {
    due: 1,
    stability: 1,
    difficulty: 1,
    elapsedDays: 0,
    scheduledDays: 0,
    learningSteps: 0,
    reps: 1,
    lapses: 0,
    state: 1,
    lastReview: null,
  };
  return {
    kind: "review",
    key,
    payload: {
      lemma: "casa",
      sentenceId,
      rating: "good",
      reviewedAt: 5,
      before: null,
      after: schedule,
      lang: "es",
    },
    updatedAt: 5,
    deleted: false,
  };
}

function gzip(text: string): Uint8Array {
  return Bun.gzipSync(new TextEncoder().encode(text));
}

export function describeSyncStore(name: string, fixture: () => Promise<StoreFixture | undefined>) {
  describe(name, () => {
    async function open() {
      return fixture();
    }

    test("last write wins by updated_at and a tie keeps the stored record", async () => {
      const ctx = await open();
      if (!ctx) {
        return;
      }
      const user = await ctx.newUser();
      await ctx.store.push(user, [position("b1", 100, 1)]);
      const older = await ctx.store.push(user, [position("b1", 50, 2)]);
      expect(older.accepted).toBe(0);
      const tie = await ctx.store.push(user, [position("b1", 100, 3)]);
      expect(tie.accepted).toBe(0);
      const newer = await ctx.store.push(user, [position("b1", 101, 4)]);
      expect(newer.accepted).toBe(1);
      const page = await ctx.store.pull(user, 0, 500);
      expect(page.records).toHaveLength(1);
      expect(page.records[0]?.payload).toEqual({ sentenceId: 4 });
      expect(page.records[0]?.updatedAt).toBe(101);
    });

    test("an absent key is inserted even with a small updated_at", async () => {
      const ctx = await open();
      if (!ctx) {
        return;
      }
      const user = await ctx.newUser();
      const result = await ctx.store.push(user, [position("b1", 0, 1)]);
      expect(result.accepted).toBe(1);
    });

    test("review records are append-only: the first write wins", async () => {
      const ctx = await open();
      if (!ctx) {
        return;
      }
      const user = await ctx.newUser();
      const key = "es:5:casa";
      expect((await ctx.store.push(user, [review(key, 1)])).accepted).toBe(1);
      expect((await ctx.store.push(user, [review(key, 2)])).accepted).toBe(0);
      const page = await ctx.store.pull(user, 0, 500);
      expect((page.records[0]?.payload as { sentenceId: number }).sentenceId).toBe(1);
    });

    test("tombstones are stored with a null payload and replaced by newer writes", async () => {
      const ctx = await open();
      if (!ctx) {
        return;
      }
      const user = await ctx.newUser();
      await ctx.store.push(user, [position("b1", 10, 1)]);
      await ctx.store.push(user, [
        { kind: "position", key: "b1", payload: null, updatedAt: 20, deleted: true },
      ]);
      const page = await ctx.store.pull(user, 0, 500);
      expect(page.records[0]).toMatchObject({ deleted: true, payload: null, updatedAt: 20 });
      await ctx.store.push(user, [position("b1", 30, 9)]);
      const again = await ctx.store.pull(user, 0, 500);
      expect(again.records[0]).toMatchObject({ deleted: false, payload: { sentenceId: 9 } });
    });

    test("pull pages by seq with a shared limit across records and books", async () => {
      const ctx = await open();
      if (!ctx) {
        return;
      }
      const user = await ctx.newUser();
      await ctx.store.push(user, [position("a", 1, 1)]);
      await ctx.store.putBook(user, {
        id: "book1",
        lang: "es",
        title: "T",
        addedAt: 7,
        data: gzip("x"),
      });
      await ctx.store.push(user, [position("b", 1, 1), position("c", 1, 1)]);
      const first = await ctx.store.pull(user, 0, 2);
      expect(first.records.length + first.books.length).toBe(2);
      expect(first.more).toBe(true);
      expect(first.books[0]).toMatchObject({ id: "book1", title: "T", addedAt: 7, deleted: false });
      const second = await ctx.store.pull(user, first.cursor, 2);
      expect(second.records.length + second.books.length).toBe(2);
      expect(second.more).toBe(false);
      expect(second.records.map((r) => r.key)).toEqual(["b", "c"]);
      const empty = await ctx.store.pull(user, second.cursor, 2);
      expect(empty).toEqual({ records: [], books: [], cursor: second.cursor, more: false });
      const exact = await ctx.store.pull(user, 0, 4);
      expect(exact.more).toBe(false);
    });

    test("books round-trip bytes, tombstone clears data and quota counts live books", async () => {
      const ctx = await open();
      if (!ctx) {
        return;
      }
      const user = await ctx.newUser();
      const data = gzip("hello book");
      const book = { id: "b1", lang: "es", title: "Title", addedAt: 1, data };
      expect(await ctx.store.putBook(user, book)).toBe("stored");
      expect(await ctx.store.getBook(user, "b1")).toEqual(data);
      await ctx.store.deleteBook(user, "b1");
      expect(await ctx.store.getBook(user, "b1")).toBeUndefined();
      const page = await ctx.store.pull(user, 0, 500);
      expect(page.books[0]).toMatchObject({ id: "b1", deleted: true, bytes: 0 });
      for (let index = 0; index < 50; index += 1) {
        expect(await ctx.store.putBook(user, { ...book, id: `n${index}` })).toBe("stored");
      }
      expect(await ctx.store.putBook(user, { ...book, id: "overflow" })).toBe("quota_exceeded");
      expect(await ctx.store.putBook(user, { ...book, id: "n0" })).toBe("stored");
    });

    test("users cannot see or overwrite each other's data", async () => {
      const ctx = await open();
      if (!ctx) {
        return;
      }
      const alice = await ctx.newUser();
      const bob = await ctx.newUser();
      const data = gzip("alice");
      await ctx.store.push(alice, [position("b1", 100, 1)]);
      await ctx.store.putBook(alice, { id: "b1", lang: "es", title: "A", addedAt: 1, data });
      expect((await ctx.store.pull(bob, 0, 500)).records).toHaveLength(0);
      expect((await ctx.store.pull(bob, 0, 500)).books).toHaveLength(0);
      expect(await ctx.store.getBook(bob, "b1")).toBeUndefined();
      await ctx.store.push(bob, [position("b1", 200, 2)]);
      await ctx.store.putBook(bob, {
        id: "b1",
        lang: "es",
        title: "B",
        addedAt: 1,
        data: gzip("b"),
      });
      await ctx.store.deleteBook(bob, "b1");
      const page = await ctx.store.pull(alice, 0, 500);
      expect(page.records[0]?.payload).toEqual({ sentenceId: 1 });
      expect(page.books[0]).toMatchObject({ title: "A", deleted: false });
      expect(await ctx.store.getBook(alice, "b1")).toEqual(data);
    });
  });
}
