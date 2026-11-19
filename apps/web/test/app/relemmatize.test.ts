import { describe, expect, test } from "bun:test";
import type { Book } from "@glyphfern/core";
import { AppStore } from "../../src/app/store";
import { MemoryRepository } from "../../src/storage/memory-repository";
import { openTestRepository } from "../../src/test-support";

const options = { prefersReducedMotion: false, initialRoute: "read" as const };

const MIRAR = { miraba: "mirar", miraban: "mirar", miré: "mirar" };

function epubFiles(title: string): Record<string, string> {
  return {
    "META-INF/container.xml":
      '<container><rootfiles><rootfile full-path="c.opf"/></rootfiles></container>',
    "c.opf": `<package><metadata><dc:title>${title}</dc:title></metadata><manifest><item id="a" href="a.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="a"/></spine></package>`,
    "a.xhtml": "<body><h1>Uno</h1><p>Miraba el mar. Miraban el mar. Miré el mar.</p></body>",
  };
}

function lemmasOf(book: Book): string[] {
  return book.chapters.flatMap((chapter) =>
    chapter.paragraphs.flat().flatMap((sentence) => sentence.tokens.map((token) => token.lemma)),
  );
}

function firstSentenceId(book: Book): number {
  return book.chapters[0]?.paragraphs[0]?.[0]?.id ?? 0;
}

function controlledLemmatizer() {
  const control: { answer: Record<string, string> | null; calls: number } = {
    answer: null,
    calls: 0,
  };
  const lemmatizer = async () => {
    control.calls += 1;
    return control.answer;
  };
  return { control, lemmatizer };
}

async function openWithImport() {
  const { control, lemmatizer } = controlledLemmatizer();
  const repository = new MemoryRepository();
  const store = await AppStore.open(repository, { ...options, lemmatizer });
  const stored = await store.actions.importEpub(epubFiles("El mar"));
  return { control, lemmatizer, repository, store, stored };
}

describe("importing without lemmas", () => {
  test("a null lemmatizer result still imports the book and flags it as not lemmatized", async () => {
    const { repository, stored } = await openWithImport();
    expect(stored.lemmatized).toBe(false);
    expect(lemmasOf(stored.book)).toContain("miraba");
    expect((await repository.loadBooks())[0]?.lemmatized).toBe(false);
  });

  test("a store without a lemmatizer flags the book as not lemmatized", async () => {
    const store = await AppStore.open(new MemoryRepository(), options);
    const stored = await store.actions.importEpub(epubFiles("El mar"));
    expect(stored.lemmatized).toBe(false);
    await store.relemmatizePending();
    expect(store.getApi().state.userBooks[0]?.lemmatized).toBe(false);
  });

  test("a lemmatizer map flags the book as lemmatized", async () => {
    const { control, lemmatizer } = controlledLemmatizer();
    control.answer = MIRAR;
    const store = await AppStore.open(new MemoryRepository(), { ...options, lemmatizer });
    const stored = await store.actions.importEpub(epubFiles("El mar"));
    expect(stored.lemmatized).toBe(true);
    expect(lemmasOf(stored.book)).not.toContain("miraba");
  });

  test("the lemmatized flag survives a round trip through IndexedDB", async () => {
    const { repository } = await openTestRepository();
    const store = await AppStore.open(repository, options);
    await store.actions.importEpub(epubFiles("El mar"));
    const [stored] = await repository.loadBooks();
    expect(stored?.lemmatized).toBe(false);
    if (stored) {
      await repository.saveBook({ ...stored, lemmatized: true });
    }
    expect((await repository.loadBooks())[0]?.lemmatized).toBe(true);
  });
});

describe("relemmatizing pending books", () => {
  test("surface forms collapse to one lemma in the active book and the book is flagged", async () => {
    const { control, repository, store, stored } = await openWithImport();
    await store.actions.openBook(stored.id);
    control.answer = MIRAR;
    await store.relemmatizePending();
    const state = store.getApi().state;
    expect(state.userBooks[0]?.lemmatized).toBe(true);
    expect(state.pack.book.id).toBe(stored.id);
    const lemmas = lemmasOf(state.pack.book);
    expect(lemmas.filter((lemma) => lemma === "mirar")).toHaveLength(3);
    expect(lemmas).not.toContain("miraba");
    expect(state.books.find((book) => book.id === stored.id)).toBe(state.pack.book);
    await store.settled();
    const saved = (await repository.loadBooks())[0];
    expect(saved?.lemmatized).toBe(true);
    expect(saved ? lemmasOf(saved.book) : []).toContain("mirar");
  });

  test("an unavailable lemmatizer leaves the book untouched and it is retried later", async () => {
    const { control, repository, store, stored } = await openWithImport();
    const callsBefore = control.calls;
    await store.relemmatizePending();
    expect(control.calls).toBe(callsBefore + 1);
    expect(store.getApi().state.userBooks[0]).toEqual(stored);
    expect((await repository.loadBooks())[0]?.lemmatized).toBe(false);
    control.answer = MIRAR;
    await store.relemmatizePending();
    expect(store.getApi().state.userBooks[0]?.lemmatized).toBe(true);
  });

  test("opening the store retries pending books and settled waits for it", async () => {
    const { control, repository } = await openWithImport();
    control.answer = MIRAR;
    const reopened = await AppStore.open(repository, {
      ...options,
      lemmatizer: async () => control.answer,
    });
    await reopened.settled();
    expect(reopened.getApi().state.userBooks[0]?.lemmatized).toBe(true);
    expect((await repository.loadBooks())[0]?.lemmatized).toBe(true);
  });

  test("a book stored without the flag counts as not lemmatized", async () => {
    const { control, repository } = await openWithImport();
    const [stored] = await repository.loadBooks();
    if (stored) {
      const { lemmatized: _flag, ...legacy } = stored;
      await repository.saveBook(legacy);
    }
    control.answer = MIRAR;
    const reopened = await AppStore.open(repository, {
      ...options,
      lemmatizer: async () => control.answer,
    });
    await reopened.settled();
    expect(reopened.getApi().state.userBooks[0]?.lemmatized).toBe(true);
  });

  test("an already lemmatized book is not sent to the lemmatizer again", async () => {
    const { control, lemmatizer } = controlledLemmatizer();
    control.answer = MIRAR;
    const store = await AppStore.open(new MemoryRepository(), { ...options, lemmatizer });
    await store.actions.importEpub(epubFiles("El mar"));
    const callsBefore = control.calls;
    await store.relemmatizePending();
    expect(control.calls).toBe(callsBefore);
  });
});

describe("progress follows the new lemma", () => {
  test("a card of the book moves to the new lemma and keeps its sentence", async () => {
    const { control, repository, store, stored } = await openWithImport();
    const sentenceId = firstSentenceId(stored.book);
    store.actions.addCard("miraba", sentenceId);
    control.answer = MIRAR;
    await store.relemmatizePending();
    await store.settled();
    const cards = store.getApi().state.cards;
    expect(cards.find((card) => card.lemma === "mirar")).toEqual({ lemma: "mirar", sentenceId });
    expect(cards.some((card) => card.lemma === "miraba")).toBe(false);
    const saved = (await repository.loadLanguage("es")).cards;
    expect(saved.find((card) => card.lemma === "mirar")).toEqual({ lemma: "mirar", sentenceId });
    expect(saved.some((card) => card.lemma === "miraba")).toBe(false);
  });

  test("a moved card keeps its review schedule", async () => {
    const { control, repository, store, stored } = await openWithImport();
    store.actions.addCard("miraba", firstSentenceId(stored.book));
    store.actions.rateCard(["miraba"], "good");
    const scheduled = store.getApi().state.cards.find((card) => card.lemma === "miraba")?.schedule;
    expect(scheduled).toBeDefined();
    control.answer = MIRAR;
    await store.relemmatizePending();
    await store.settled();
    const moved = store.getApi().state.cards.find((card) => card.lemma === "mirar");
    expect(moved?.schedule).toEqual(scheduled);
    const saved = (await repository.loadLanguage("es")).cards.find(
      (card) => card.lemma === "mirar",
    );
    expect(saved?.schedule).toEqual(scheduled);
  });

  test("two cards collapsing to one lemma leave a single card", async () => {
    const { control, store, stored } = await openWithImport();
    const sentenceId = firstSentenceId(stored.book);
    store.actions.addCard("miraba", sentenceId);
    store.actions.addCard("miraban", sentenceId + 1);
    control.answer = MIRAR;
    await store.relemmatizePending();
    const mirar = store.getApi().state.cards.filter((card) => card.lemma === "mirar");
    expect(mirar).toEqual([{ lemma: "mirar", sentenceId }]);
    expect(store.getApi().state.cards.some((card) => card.lemma === "miraban")).toBe(false);
  });

  test("an existing card for the new lemma wins and the old card is dropped", async () => {
    const { control, repository, store, stored } = await openWithImport();
    store.actions.addCard("mirar", 5);
    store.actions.addCard("miraba", firstSentenceId(stored.book));
    control.answer = MIRAR;
    await store.relemmatizePending();
    await store.settled();
    const mirar = store.getApi().state.cards.filter((card) => card.lemma === "mirar");
    expect(mirar).toEqual([{ lemma: "mirar", sentenceId: 5 }]);
    expect(store.getApi().state.cards.some((card) => card.lemma === "miraba")).toBe(false);
    const saved = (await repository.loadLanguage("es")).cards;
    expect(saved.filter((card) => card.lemma === "mirar")).toEqual(mirar);
    expect(saved.some((card) => card.lemma === "miraba")).toBe(false);
  });

  test("cards of other books are never touched", async () => {
    const { control, store, stored } = await openWithImport();
    store.actions.addCard("miraba", 5);
    store.actions.addCard("miraban", 2_000_001);
    store.actions.addCard("miré", firstSentenceId(stored.book));
    control.answer = MIRAR;
    await store.relemmatizePending();
    const cards = store.getApi().state.cards;
    expect(cards.find((card) => card.lemma === "miraba")).toEqual({
      lemma: "miraba",
      sentenceId: 5,
    });
    expect(cards.find((card) => card.lemma === "miraban")).toEqual({
      lemma: "miraban",
      sentenceId: 2_000_001,
    });
    expect(cards.find((card) => card.lemma === "mirar")?.sentenceId).toBe(
      firstSentenceId(stored.book),
    );
  });

  test("a word state is copied to the new lemma and the old entry stays", async () => {
    const { control, repository, store } = await openWithImport();
    store.actions.setWordState("miraba", "known");
    control.answer = MIRAR;
    await store.relemmatizePending();
    await store.settled();
    expect(store.getApi().stateOf("mirar")).toEqual({ kind: "known" });
    expect(store.getApi().stateOf("miraba")).toEqual({ kind: "known" });
    expect((await repository.loadLanguage("es")).states.mirar).toEqual({ kind: "known" });
  });

  test("an existing state of the new lemma is left alone", async () => {
    const { control, store } = await openWithImport();
    store.actions.setWordState("miraba", "known");
    store.actions.setWordState("mirar", "learning");
    control.answer = MIRAR;
    await store.relemmatizePending();
    expect(store.getApi().stateOf("mirar")).toEqual({ kind: "learning", level: 3 });
  });

  test("progress is migrated when another language is active", async () => {
    const { control, repository, store, stored } = await openWithImport();
    const sentenceId = firstSentenceId(stored.book);
    store.actions.addCard("miraba", sentenceId);
    store.actions.setWordState("miraban", "known");
    await store.actions.switchLanguage("ko");
    const koreanCards = store.getApi().state.cards;
    control.answer = MIRAR;
    await store.relemmatizePending();
    expect(store.getApi().state.lang).toBe("ko");
    expect(store.getApi().state.cards).toEqual(koreanCards);
    expect(store.getApi().state.userBooks[0]?.lemmatized).toBe(true);
    await store.settled();
    const saved = await repository.loadLanguage("es");
    expect(saved.cards.find((card) => card.lemma === "mirar")).toEqual({
      lemma: "mirar",
      sentenceId,
    });
    expect(saved.cards.some((card) => card.lemma === "miraba")).toBe(false);
    expect(saved.states.mirar).toEqual({ kind: "known" });
    await store.actions.switchLanguage("es");
    const state = store.getApi().state;
    expect(state.cards.find((card) => card.lemma === "mirar")?.sentenceId).toBe(sentenceId);
    expect(state.cards.some((card) => card.lemma === "miraba")).toBe(false);
    expect(state.wordStates.mirar).toEqual({ kind: "known" });
  });
});
