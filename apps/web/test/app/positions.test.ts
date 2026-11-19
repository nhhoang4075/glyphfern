import { describe, expect, test } from "bun:test";
import { defaultPreferences } from "../../src/app/defaults";
import { AppStore } from "../../src/app/store";
import { MemoryRepository } from "../../src/storage/memory-repository";
import { openTestRepository } from "../../src/test-support";

const options = { prefersReducedMotion: false, initialRoute: "read" as const };

const LONG = "Había una vez una niña que vivía cerca del bosque. ".repeat(8);

function epubFiles(title: string): Record<string, string> {
  return {
    "META-INF/container.xml":
      '<container><rootfiles><rootfile full-path="c.opf"/></rootfiles></container>',
    "c.opf": `<package><metadata><dc:title>${title}</dc:title></metadata><manifest><item id="a" href="a.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="a"/></spine></package>`,
    "a.xhtml": `<body><h1>Uno</h1><p>${LONG}</p></body>`,
  };
}

describe("remembered reading positions", () => {
  test("the default preferences have no positions", () => {
    expect(defaultPreferences(false).positions).toEqual({});
  });

  test("preferences stored before positions existed open with an empty map", async () => {
    const repository = new MemoryRepository();
    const { positions: _omitted, ...legacy } = defaultPreferences(false);
    await repository.savePreferences({ ...legacy, size: 25 } as never);
    const store = await AppStore.open(repository, options);
    expect(store.getApi().state.preferences.positions).toEqual({});
    expect(store.getApi().state.preferences.size).toBe(25);
  });

  test("a remembered position is stored per book and survives a reload", async () => {
    const { name, repository } = await openTestRepository();
    const store = await AppStore.open(repository, options);
    store.actions.rememberPosition("book-a", 7);
    store.actions.rememberPosition("book-b", 3);
    store.actions.rememberPosition("book-a", 9);
    await store.settled();
    const reopened = await AppStore.open((await openTestRepository(name)).repository, options);
    expect(reopened.getApi().state.preferences.positions).toEqual({
      "book-a": 9,
      "book-b": 3,
    });
  });

  test("remembering a position does not publish a new app state", async () => {
    const store = await AppStore.open(new MemoryRepository(), options);
    const before = store.getApi();
    let notified = 0;
    store.subscribe(() => {
      notified += 1;
    });
    store.actions.rememberPosition("book-a", 7);
    expect(notified).toBe(0);
    expect(store.getApi()).toBe(before);
    expect(store.getApi().state.preferences.positions["book-a"]).toBe(7);
  });

  test("later preference changes and book switches save the latest positions", async () => {
    const repository = new MemoryRepository();
    const store = await AppStore.open(repository, options);
    store.actions.rememberPosition("book-a", 7);
    store.actions.setPreference("size", 24);
    await store.settled();
    expect((await repository.loadPreferences())?.positions).toEqual({ "book-a": 7 });

    store.actions.rememberPosition("book-a", 11);
    const stored = await store.actions.importEpub(epubFiles("El lobo"));
    await store.actions.openBook(stored.id);
    await store.settled();
    expect((await repository.loadPreferences())?.positions).toEqual({ "book-a": 11 });

    store.actions.rememberPosition("other-book", 2);
    store.actions.setPreference("lh", 1.85);
    await store.settled();
    expect((await repository.loadPreferences())?.positions).toEqual({
      "book-a": 11,
      "other-book": 2,
    });
  });

  test("saving the same position twice writes nothing new", async () => {
    const repository = new MemoryRepository();
    const store = await AppStore.open(repository, options);
    store.actions.rememberPosition("book-a", 7);
    await store.settled();
    let writes = 0;
    const save = repository.savePreferences.bind(repository);
    repository.savePreferences = async (preferences) => {
      writes += 1;
      await save(preferences);
    };
    store.actions.rememberPosition("book-a", 7);
    await store.settled();
    expect(writes).toBe(0);
  });

  test("deleting an imported book removes its position and keeps the others", async () => {
    const repository = new MemoryRepository();
    const store = await AppStore.open(repository, options);
    const stored = await store.actions.importEpub(epubFiles("El lobo"));
    store.actions.rememberPosition(stored.id, 1_000_001);
    store.actions.rememberPosition("book-a", 4);
    store.actions.deleteBook(stored.id);
    await store.settled();
    expect(store.getApi().state.preferences.positions).toEqual({ "book-a": 4 });
    expect((await repository.loadPreferences())?.positions).toEqual({ "book-a": 4 });
  });

  test("positions of an opened imported book are keyed by its stored id", async () => {
    const store = await AppStore.open(new MemoryRepository(), options);
    const stored = await store.actions.importEpub(epubFiles("El lobo"));
    await store.actions.openBook(stored.id);
    expect(store.getApi().state.preferences.bookId).toBe(stored.id);
    expect(store.getApi().state.pack.book.id).toBe(stored.id);
  });
});
