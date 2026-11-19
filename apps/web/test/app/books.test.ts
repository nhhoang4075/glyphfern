import { describe, expect, test } from "bun:test";
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

describe("importing and opening books", () => {
  test("an imported book is stored, listed and gets ids in its own range", async () => {
    const repository = new MemoryRepository();
    const store = await AppStore.open(repository, options);
    const stored = await store.actions.importEpub(epubFiles("El lobo"));
    expect(stored.book.title).toBe("El lobo");
    expect(stored.seq).toBe(1);
    expect(stored.book.chapters[0]?.title.id).toBe(1_000_000);
    expect(store.getApi().state.userBooks).toHaveLength(1);
    expect(store.getApi().state.books).toHaveLength(2);
    expect((await repository.loadBooks()).map((book) => book.id)).toEqual([stored.id]);
  });

  test("a second import gets the next id range", async () => {
    const store = await AppStore.open(new MemoryRepository(), options);
    await store.actions.importEpub(epubFiles("A"));
    const second = await store.actions.importEpub(epubFiles("B"));
    expect(second.seq).toBe(2);
    expect(second.book.chapters[0]?.title.id).toBe(2_000_000);
  });

  test("opening an imported book makes it the active book and it survives a reopen", async () => {
    const repository = new MemoryRepository();
    const store = await AppStore.open(repository, options);
    const stored = await store.actions.importEpub(epubFiles("El lobo"));
    await store.actions.openBook(stored.id);
    expect(store.getApi().state.pack.book.id).toBe(stored.id);
    await store.settled();
    const reopened = await AppStore.open(repository, options);
    expect(reopened.getApi().state.pack.book.id).toBe(stored.id);
  });

  test("opening a sample book returns to its language pack", async () => {
    const store = await AppStore.open(new MemoryRepository(), options);
    const stored = await store.actions.importEpub(epubFiles("El lobo"));
    await store.actions.openBook(stored.id);
    const sample = store.getApi().state.books[0];
    await store.actions.openBook(sample?.id ?? "");
    expect(store.getApi().state.pack.book.id).toBe(sample?.id);
  });

  test("deleting a book removes its cards and bookmarks and falls back to the sample", async () => {
    const repository = new MemoryRepository();
    const store = await AppStore.open(repository, options);
    const stored = await store.actions.importEpub(epubFiles("El lobo"));
    await store.actions.openBook(stored.id);
    const sentenceId = stored.book.chapters[0]?.title.id ?? 0;
    store.actions.toggleBookmark(sentenceId);
    store.actions.addCard("niña", sentenceId + 1);
    store.actions.deleteBook(stored.id);
    const state = store.getApi().state;
    expect(state.userBooks).toHaveLength(0);
    expect(state.bookmarks).not.toContain(sentenceId);
    expect(state.cards.some((card) => card.lemma === "niña")).toBe(false);
    expect(state.pack.book.id).not.toBe(stored.id);
    await store.settled();
    expect(await repository.loadBooks()).toEqual([]);
  });
});

describe("books in IndexedDB", () => {
  test("an imported book is read back after reopening the database", async () => {
    const { repository } = await openTestRepository();
    const store = await AppStore.open(repository, options);
    const stored = await store.actions.importEpub(epubFiles("El lobo"));
    const reopened = await AppStore.open(repository, options);
    expect(reopened.getApi().state.userBooks.map((book) => book.id)).toEqual([stored.id]);
    expect(reopened.getApi().state.userBooks[0]?.book.chapters).toHaveLength(1);
  });
});
