import { describe, expect, test } from "bun:test";
import { AppStore } from "../../src/app/store";
import { type LibraryBook, orderBooks } from "../../src/library/books";
import { MemoryRepository } from "../../src/storage/memory-repository";
import { openTestRepository } from "../../src/test-support";

const options = { prefersReducedMotion: false, initialRoute: "read" as const };

async function openMemoryStore() {
  return AppStore.open(new MemoryRepository(), options);
}

describe("store actions follow the word state table", () => {
  test("tap learning on a new word gives level 3 and a pulse, a second tap changes nothing", async () => {
    const store = await openMemoryStore();
    const first = store.actions.setWordState("lobo", "learning");
    expect(first).toEqual({ state: { kind: "learning", level: 3 }, pulse: true });
    const second = store.actions.setWordState("lobo", "learning");
    expect(second).toEqual({ state: { kind: "learning", level: 3 }, pulse: false });
  });

  test("tap known and tap new set known and remove the entry", async () => {
    const store = await openMemoryStore();
    store.actions.setWordState("lobo", "known");
    expect(store.getApi().stateOf("lobo")).toEqual({ kind: "known" });
    store.actions.setWordState("lobo", "new");
    expect(store.getApi().stateOf("lobo")).toEqual({ kind: "new" });
    expect("lobo" in store.getApi().state.wordStates).toBe(false);
  });

  test("adding a card to a new word makes it learning level 3 with a pulse", async () => {
    const store = await openMemoryStore();
    const change = store.actions.addCard("lobo", 12);
    expect(change).toEqual({ state: { kind: "learning", level: 3 }, pulse: true, added: true });
    expect(store.getApi().state.cards.at(-1)).toEqual({ lemma: "lobo", sentenceId: 12 });
  });

  test("adding a card keeps a known word known, and a duplicate card is ignored", async () => {
    const store = await openMemoryStore();
    store.actions.setWordState("casa", "known");
    const change = store.actions.addCard("casa", 1);
    expect(change).toEqual({ state: { kind: "known" }, pulse: false, added: true });
    store.actions.setWordState("enfermo", "learning");
    store.actions.addCard("enfermo", 6);
    const duplicate = store.actions.addCard("enfermo", 7);
    expect(duplicate).toEqual({
      state: { kind: "learning", level: 3 },
      pulse: false,
      added: false,
    });
    expect(store.getApi().state.cards.filter((card) => card.lemma === "enfermo")).toEqual([
      { lemma: "enfermo", sentenceId: 6 },
    ]);
  });

  test("removing a card leaves the word state unchanged", async () => {
    const store = await openMemoryStore();
    store.actions.setWordState("leña", "learning");
    store.actions.addCard("leña", 2);
    expect(store.getApi().state.cards.some((card) => card.lemma === "leña")).toBe(true);
    store.actions.removeCard("leña");
    expect(store.getApi().state.cards.some((card) => card.lemma === "leña")).toBe(false);
    expect(store.getApi().stateOf("leña")).toEqual({ kind: "learning", level: 3 });
  });

  test("focus request is stored once and consumed once", async () => {
    const store = await openMemoryStore();
    store.actions.requestFocus({ lemma: "leña", sentenceId: 2 });
    expect(store.getApi().state.focusRequest).toEqual({ lemma: "leña", sentenceId: 2 });
    expect(store.actions.consumeFocus()).toEqual({ lemma: "leña", sentenceId: 2 });
    expect(store.actions.consumeFocus()).toBeNull();
  });

  test("navigate changes the route", async () => {
    const store = await openMemoryStore();
    store.actions.navigate("words");
    expect(store.getApi().state.route).toBe("words");
  });
});

describe("persistence through Dexie", () => {
  test("word states, cards, bookmarks, pins and preferences survive a reload", async () => {
    const { name, repository } = await openTestRepository();
    const store = await AppStore.open(repository, options);
    store.actions.setWordState("lobo", "learning");
    store.actions.addCard("lobo", 12);
    store.actions.toggleBookmark(5);
    store.actions.togglePin("gamma");
    store.actions.setPreference("size", 24);
    store.actions.setPreference("paper", "#1B2420");
    await store.settled();

    const reopened = await AppStore.open((await openTestRepository(name)).repository, options);
    const state = reopened.getApi().state;
    expect(state.wordStates.lobo).toEqual({ kind: "learning", level: 3 });
    expect(state.cards.at(-1)).toEqual({ lemma: "lobo", sentenceId: 12 });
    expect(state.bookmarks).toEqual([5]);
    expect(state.pins).toEqual(["gamma"]);
    expect(state.preferences.size).toBe(24);
    expect(state.preferences.paper).toBe("#1B2420");
  });

  test("a removed card and a reset state stay removed after reload", async () => {
    const { name, repository } = await openTestRepository();
    await repository.saveCard("es", { lemma: "leña", sentenceId: 2 });
    await repository.saveWordState("es", "leña", { kind: "learning", level: 3 });
    await repository.saveWordState("es", "borde", { kind: "learning", level: 2 });
    const store = await AppStore.open(repository, options);
    expect(store.getApi().state.cards.some((card) => card.lemma === "leña")).toBe(true);
    expect(store.getApi().stateOf("borde")).toEqual({ kind: "learning", level: 2 });
    store.actions.removeCard("leña");
    store.actions.setWordState("borde", "new");
    await store.settled();

    const reopened = await AppStore.open((await openTestRepository(name)).repository, options);
    expect(reopened.getApi().state.cards.some((card) => card.lemma === "leña")).toBe(false);
    expect("borde" in reopened.getApi().state.wordStates).toBe(false);
  });
});

describe("pins", () => {
  const shelf: LibraryBook[] = ["alpha", "beta", "gamma"].map((id) => ({
    id,
    title: id,
    flag: "ES",
    colors: ["#2B5B45", "#6FA283"],
    progress: 0,
    art: "w",
    lang: "es",
  }));
  const ids = shelf.map((book) => book.id);

  test("pinned books sort first in pin order, the rest keep their order", () => {
    const ordered = orderBooks(shelf, ["gamma", "alpha"]).map((b) => b.id);
    expect(ordered).toEqual(["gamma", "alpha", "beta"]);
  });

  test("without pins the library keeps its order", () => {
    expect(orderBooks(shelf, []).map((b) => b.id)).toEqual(ids);
  });

  test("unpinning restores the original position and pin order persists", async () => {
    const { name, repository } = await openTestRepository();
    const store = await AppStore.open(repository, options);
    store.actions.togglePin("alpha");
    store.actions.togglePin("gamma");
    store.actions.togglePin("alpha");
    await store.settled();
    const reopened = await AppStore.open((await openTestRepository(name)).repository, options);
    expect(reopened.getApi().state.pins).toEqual(["gamma"]);
    expect(orderBooks(shelf, reopened.getApi().state.pins)[0]?.id).toBe("gamma");
  });
});

describe("startup preferences", () => {
  test("the default page turn follows the reduced motion request", async () => {
    const calm = await AppStore.open(new MemoryRepository(), { prefersReducedMotion: true });
    const normal = await AppStore.open(new MemoryRepository(), { prefersReducedMotion: false });
    expect(calm.getApi().state.preferences.turn).toBe("still");
    expect(normal.getApi().state.preferences.turn).toBe("curl");
    expect(normal.getApi().state.preferences).toMatchObject({
      size: 21,
      lh: 1.62,
      font: "serif",
      paper: "#FCFBF9",
      hl: 1,
      lang: "es",
    });
  });
});
