import { describe, expect, test } from "bun:test";
import { type Book, EMPTY_BOOK, coverage } from "@glyphfern/core";
import { indexBook } from "../../src/app/book-index";
import { buildWordRows } from "../../src/words/word-list";

describe("the empty book on the Words screen", () => {
  const stateOf = () => ({ kind: "new" as const });

  test("has no rows for either filter", () => {
    expect(buildWordRows(EMPTY_BOOK, stateOf, "learning")).toEqual([]);
    expect(buildWordRows(EMPTY_BOOK, stateOf, "known")).toEqual([]);
  });

  test("has zero coverage", () => {
    const sentences = indexBook(EMPTY_BOOK).sentences.filter((s) => s.kind === "body");
    expect(coverage(sentences, stateOf, 0)).toEqual({
      percent: 0,
      newLemmas: 0,
      learningLemmas: 0,
      cards: 0,
    });
  });
});

describe("unmatched tokens on the Words screen", () => {
  const book: Book = {
    ...EMPTY_BOOK,
    chapters: [
      {
        title: { id: 1, chapter: 0, kind: "title", tokens: [] },
        paragraphs: [
          [
            {
              id: 2,
              chapter: 0,
              kind: "body",
              tokens: [
                { lead: "", surf: "casa", trail: "", lemma: "casa" },
                { lead: "", surf: "Morgan", trail: "", lemma: "morgan", unmatched: true },
              ],
            },
          ],
        ],
      },
    ],
  };
  const learning = () => ({ kind: "learning" as const, level: 2 as const });

  test("are not listed even when a state exists for their lemma", () => {
    expect(buildWordRows(book, learning, "learning").map((row) => row.lemma)).toEqual(["casa"]);
  });
});
