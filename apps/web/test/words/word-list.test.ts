import { describe, expect, test } from "bun:test";
import { EMPTY_BOOK, coverage } from "@glyphfern/core";
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
