import { describe, expect, test } from "bun:test";
import { EMPTY_BOOK } from "@glyphfern/core";
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

describe("import preview", () => {
  const files = {
    ...epubFiles("Dos"),
    "c.opf": `<package><metadata><dc:title>Dos</dc:title></metadata><manifest><item id="a" href="a.xhtml" media-type="application/xhtml+xml"/><item id="b" href="b.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="a"/><itemref idref="b"/></spine></package>`,
    "b.xhtml": `<body><h1>Dos</h1><p>${LONG.repeat(2)}</p></body>`,
  };

  test("previewing stores nothing and importing keeps only the chosen chapters", async () => {
    const store = await AppStore.open(new MemoryRepository(), options);
    const preview = store.actions.previewEpub(files);
    expect(preview.chapters).toHaveLength(2);
    expect(store.getApi().state.userBooks).toEqual([]);
    const stored = await store.actions.importEpub(files, [preview.chapters[1]?.id ?? ""]);
    expect(stored.book.chapters).toHaveLength(1);
    expect(store.getApi().state.userBooks).toHaveLength(1);
  });
});

describe("the app ships no book", () => {
  test("a fresh store has no books and the active book is the empty book", async () => {
    const state = (await AppStore.open(new MemoryRepository(), options)).getApi().state;
    expect(state.books).toEqual([]);
    expect(state.userBooks).toEqual([]);
    expect(state.preferences.bookId).toBeNull();
    expect(state.pack.book).toBe(EMPTY_BOOK);
    expect(state.pack.book.chapters).toEqual([]);
    expect(state.pack.book.id).toBe("");
    expect(state.pack.book.title).toBe("");
  });

  test("opening an imported book makes it the active book", async () => {
    const store = await AppStore.open(new MemoryRepository(), options);
    const stored = await store.actions.importEpub(epubFiles("El lobo"));
    await store.actions.openBook(stored.id);
    const state = store.getApi().state;
    expect(state.pack.book).toBe(stored.book);
    expect(state.preferences.bookId).toBe(stored.id);
    expect(state.pack.book.chapters.length).toBeGreaterThan(0);
  });

  test("opening an unknown book id changes nothing", async () => {
    const store = await AppStore.open(new MemoryRepository(), options);
    await store.actions.openBook("la-nina-y-el-lobo");
    expect(store.getApi().state.pack.book).toBe(EMPTY_BOOK);
    expect(store.getApi().state.preferences.bookId).toBeNull();
  });

  test("preferences stored with a removed sample book id and lang ko load and fall back", async () => {
    const repository = new MemoryRepository();
    await repository.savePreferences({
      ...defaultPreferences(false),
      lang: "ko" as never,
      bookId: "ppalgan-moja",
      positions: { "ppalgan-moja": 3, "la-nina-y-el-lobo": 5 },
      size: 25,
    });
    const store = await AppStore.open(repository, options);
    const state = store.getApi().state;
    expect(state.lang).toBe("es");
    expect(state.preferences.lang).toBe("es");
    expect(state.preferences.bookId).toBeNull();
    expect(state.pack.book).toBe(EMPTY_BOOK);
    expect(state.preferences.size).toBe(25);
    expect(state.preferences.positions).toEqual({ "ppalgan-moja": 3, "la-nina-y-el-lobo": 5 });
  });

  test("a stored book id that no longer exists falls back to the empty book", async () => {
    const repository = new MemoryRepository();
    await repository.savePreferences({ ...defaultPreferences(false), bookId: "user-9-gone" });
    const state = (await AppStore.open(repository, options)).getApi().state;
    expect(state.preferences.bookId).toBeNull();
    expect(state.pack.book).toBe(EMPTY_BOOK);
  });
});

describe("importing and opening books", () => {
  test("an imported book is stored, listed and gets ids in its own range", async () => {
    const repository = new MemoryRepository();
    const store = await AppStore.open(repository, { ...options, random: () => 0 });
    const stored = await store.actions.importEpub(epubFiles("El lobo"));
    expect(stored.book.title).toBe("El lobo");
    expect(stored.seq).toBe(1000);
    expect(stored.book.chapters[0]?.title.id).toBe(1_000_000_000);
    expect(store.getApi().state.userBooks).toHaveLength(1);
    expect(store.getApi().state.books).toEqual([stored.book]);
    expect((await repository.loadBooks()).map((book) => book.id)).toEqual([stored.id]);
  });

  test("a second import draws another slot when the first draw is taken", async () => {
    const draws = [0, 0, 0.5];
    const store = await AppStore.open(new MemoryRepository(), {
      ...options,
      random: () => draws.shift() ?? 0.25,
    });
    await store.actions.importEpub(epubFiles("A"));
    const second = await store.actions.importEpub(epubFiles("B"));
    expect(second.seq).toBe(1000 + Math.floor(0.5 * (2 ** 30 - 1000)));
    expect(second.book.chapters[0]?.title.id).toBe(second.seq * 1_000_000);
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

  test("deleting a book removes its cards and bookmarks and falls back to the empty book", async () => {
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
    expect(state.pack.book).toBe(EMPTY_BOOK);
    expect(state.preferences.bookId).toBeNull();
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

describe("lemmas on import", () => {
  test("the lemmatizer result is written into the stored book", async () => {
    const store = await AppStore.open(new MemoryRepository(), {
      ...options,
      lemmatizer: async () => ({ lemmas: { había: "haber" }, unknown: [] }),
    });
    const stored = await store.actions.importEpub(epubFiles("El lobo"));
    const lemmas = stored.book.chapters[0]?.paragraphs[0]?.[0]?.tokens.map((t) => t.lemma);
    expect(lemmas?.[0]).toBe("haber");
  });

  test("unknown words are flagged unmatched unless the static dictionary has them", async () => {
    const store = await AppStore.open(new MemoryRepository(), {
      ...options,
      lemmatizer: async () => ({ lemmas: {}, unknown: ["cerca", "bosque"] }),
    });
    const stored = await store.actions.importEpub(epubFiles("El lobo"));
    const tokens = stored.book.chapters[0]?.paragraphs[0]?.[0]?.tokens ?? [];
    const flagged = tokens.filter((token) => token.unmatched === true).map((token) => token.surf);
    expect([...new Set(flagged)]).toEqual(["cerca"]);
  });

  test("a failed lemmatizer marks nothing unmatched", async () => {
    const store = await AppStore.open(new MemoryRepository(), {
      ...options,
      lemmatizer: async () => null,
    });
    const stored = await store.actions.importEpub(epubFiles("El lobo"));
    const tokens = stored.book.chapters[0]?.paragraphs[0]?.[0]?.tokens ?? [];
    expect(tokens.some((token) => token.unmatched)).toBe(false);
  });
});
