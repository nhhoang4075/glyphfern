import { describe, expect, test } from "bun:test";
import { AppStore } from "../../src/app/store";
import { MemoryRepository } from "../../src/storage/memory-repository";
import type { Repository } from "../../src/storage/repository";
import { syncOnce } from "../../src/sync/engine";
import { HttpError } from "../../src/sync/http";
import { openTestRepository } from "../../src/test-support";
import { FakeServer } from "./fake-server";

const EMAIL = "owner@example.com";
const LONG = "Había una vez una niña que vivía cerca del bosque. ".repeat(8);

function epubFiles(title: string): Record<string, string> {
  return {
    "META-INF/container.xml":
      '<container><rootfiles><rootfile full-path="c.opf"/></rootfiles></container>',
    "c.opf": `<package><metadata><dc:title>${title}</dc:title></metadata><manifest><item id="a" href="a.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="a"/></spine></package>`,
    "a.xhtml": `<body><h1>Uno</h1><p>${LONG}</p></body>`,
  };
}

interface Device {
  clock: { t: number };
  repository: Repository;
  store: AppStore;
}

type RepositoryFactory = (now: () => number) => Promise<Repository>;

async function createDevice(
  create: RepositoryFactory,
  start: number,
  random: number,
): Promise<Device> {
  const clock = { t: start };
  const repository = await create(() => clock.t);
  const store = await AppStore.open(repository, {
    prefersReducedMotion: false,
    initialRoute: "read",
    now: () => clock.t,
    random: () => random,
  });
  return { clock, repository, store };
}

async function sync(device: Device, server: FakeServer) {
  await device.store.settled();
  const outcome = await syncOnce({
    repository: device.repository,
    api: server.api(),
    email: EMAIL,
    now: () => device.clock.t,
  });
  if (outcome.changed) {
    await device.store.actions.reload();
  }
  return outcome;
}

function view(device: Device) {
  const { state } = device.store.getApi();
  return {
    states: state.wordStates,
    cards: [...state.cards].sort((x, y) => x.lemma.localeCompare(y.lemma)),
    bookmarks: state.bookmarks,
    pins: state.pins,
    size: state.preferences.size,
    books: state.userBooks.map((book) => book.id),
  };
}

const FACTORIES: Array<[string, RepositoryFactory]> = [
  ["memory", async (now) => new MemoryRepository(now)],
  ["dexie", async (now) => (await openTestRepository(undefined, now)).repository],
];

for (const [name, create] of FACTORIES) {
  describe(`two devices on ${name} storage`, () => {
    test("offline edits on both devices converge after syncing", async () => {
      const server = new FakeServer();
      const a = await createDevice(create, 1_000_000, 0.1);
      const b = await createDevice(create, 1_000_000, 0.7);

      a.clock.t = 1_001_000;
      a.store.actions.setWordState("lobo", "known");
      a.clock.t = 1_001_100;
      a.store.actions.addCard("casa", 5);
      a.clock.t = 1_001_200;
      a.store.actions.toggleBookmark(5);
      const imported = await a.store.actions.importEpub(epubFiles("Libro A"));
      a.store.actions.togglePin(imported.id);
      a.clock.t = 1_001_300;
      a.store.actions.setPreference("size", 25);

      b.clock.t = 1_002_000;
      b.store.actions.setWordState("lobo", "learning");
      b.clock.t = 1_002_100;
      b.store.actions.addCard("gato", 7);
      b.store.actions.toggleBookmark(9);
      const importedB = await b.store.actions.importEpub(epubFiles("Libro B"));
      expect(importedB.seq).not.toBe(imported.seq);

      await sync(a, server);
      await sync(b, server);
      await sync(a, server);
      await sync(b, server);

      expect(view(a)).toEqual(view(b));
      const converged = view(a);
      expect(converged.states.lobo).toEqual({ kind: "learning", level: 3 });
      expect(converged.cards.map((card) => card.lemma).sort()).toEqual(["casa", "gato"]);
      expect(converged.bookmarks).toEqual([9]);
      expect(converged.size).toBe(25);
      expect(converged.books.sort()).toEqual([imported.id, importedB.id].sort());
      expect(await a.repository.readOutbox()).toEqual([]);
      expect(await b.repository.readOutbox()).toEqual([]);
    });

    test("reviews from both devices merge into one append-only log", async () => {
      const server = new FakeServer();
      const a = await createDevice(create, 5_000_000, 0.1);
      const b = await createDevice(create, 5_000_000, 0.2);
      a.store.actions.addCard("casa", 5);
      b.store.actions.addCard("casa", 5);
      b.store.actions.addCard("gato", 6);
      await sync(a, server);
      await sync(b, server);
      await sync(a, server);

      a.clock.t = 5_100_000;
      a.store.actions.rateCard(["casa"], "good");
      b.clock.t = 5_200_000;
      b.store.actions.rateCard(["gato"], "again");
      await sync(a, server);
      await sync(b, server);
      await sync(a, server);

      const logA = await a.repository.loadReviewLog("es");
      const logB = await b.repository.loadReviewLog("es");
      expect(logA.map((entry) => entry.lemma)).toEqual(["casa", "gato"]);
      expect(logB).toEqual(logA);
    });

    test("a deletion on one device removes the card, the book and its tombstone propagates", async () => {
      const server = new FakeServer();
      const a = await createDevice(create, 9_000_000, 0.1);
      const b = await createDevice(create, 9_000_000, 0.4);
      const book = await a.store.actions.importEpub(epubFiles("Libro"));
      a.store.actions.addCard("niña", book.seq * 1_000_000 + 1);
      await sync(a, server);
      await sync(b, server);
      expect(view(b).books).toEqual([book.id]);
      expect(view(b).cards.map((card) => card.lemma)).toEqual(["niña"]);
      expect(view(b).states.niña).toEqual({ kind: "learning", level: 3 });

      a.clock.t = 9_500_000;
      a.store.actions.deleteBook(book.id);
      await sync(a, server);
      b.clock.t = 9_600_000;
      await sync(b, server);
      expect(view(b).books).toEqual([]);
      expect(view(b).cards).toEqual([]);
    });

    test("the first sign-in uploads pre-existing local data and a second device downloads it", async () => {
      const server = new FakeServer();
      const a = await createDevice(create, 2_000_000, 0.3);
      await a.repository.removeOutbox(
        (await a.repository.readOutbox()).map((entry) => entry.id as number),
      );
      await a.repository.saveBookmarks("es", [11]);
      await a.repository.removeOutbox(
        (await a.repository.readOutbox()).map((entry) => entry.id as number),
      );
      await sync(a, server);
      expect(server.records.get("bookmarks\u0000es")?.payload).toEqual({ sentenceIds: [11] });

      const b = await createDevice(create, 2_000_000, 0.9);
      await sync(b, server);
      expect(view(b).bookmarks).toEqual([11]);
    });

    test("a failed push leaves the outbox intact and the next run delivers it", async () => {
      const server = new FakeServer();
      const a = await createDevice(create, 3_000_000, 0.3);
      a.store.actions.setWordState("lobo", "known");
      await a.store.settled();
      server.failNext = new HttpError(503, null);
      await expect(sync(a, server)).rejects.toBeInstanceOf(HttpError);
      expect((await a.repository.readOutbox()).length).toBeGreaterThan(0);
      await sync(a, server);
      expect(server.records.get("wordState\u0000es:lobo")?.payload).toEqual({ kind: "known" });
      expect(await a.repository.readOutbox()).toEqual([]);
    });

    test("more than 500 pending records go out in several batches", async () => {
      const server = new FakeServer();
      const a = await createDevice(create, 4_000_000, 0.3);
      for (let index = 0; index < 620; index += 1) {
        await a.repository.saveWordState("es", `w${index}`, { kind: "known" });
      }
      await sync(a, server);
      expect(server.pushCalls.every((size) => size <= 500)).toBe(true);
      expect(server.pushCalls.reduce((sum, size) => sum + size, 0)).toBeGreaterThanOrEqual(620);
      expect(server.records.size).toBeGreaterThanOrEqual(620);
    });
  });
}
