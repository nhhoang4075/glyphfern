import { describe, expect, test } from "bun:test";
import { applyLemmas, bookWords } from "../../src/import/apply-lemmas";
import type { Book } from "../../src/types";

const book: Book = {
  id: "b",
  title: "B",
  lang: "es",
  chapters: [
    {
      title: {
        id: 1,
        chapter: 0,
        kind: "title",
        tokens: [{ lead: "", surf: "Uno", trail: "", lemma: "uno" }],
      },
      paragraphs: [
        [
          {
            id: 2,
            chapter: 0,
            kind: "body",
            tokens: [
              { lead: "", surf: "Miraba", trail: "", lemma: "miraba" },
              { lead: "", surf: "lobo", trail: ".", lemma: "lobo" },
            ],
          },
        ],
      ],
    },
  ],
};

describe("lemmas for a book", () => {
  test("the distinct lowercase words are collected", () => {
    expect(bookWords(book).sort()).toEqual(["lobo", "miraba", "uno"]);
  });

  test("known forms get their lemma and the rest keep the lowercase surface", () => {
    const result = applyLemmas(book, { miraba: "mirar" });
    const tokens = result.chapters[0]?.paragraphs[0]?.[0]?.tokens.map((t) => t.lemma);
    expect(tokens).toEqual(["mirar", "lobo"]);
    expect(result.chapters[0]?.title.tokens[0]?.lemma).toBe("uno");
    expect(book.chapters[0]?.paragraphs[0]?.[0]?.tokens[0]?.lemma).toBe("miraba");
  });

  test("inherited object keys and non-string values are ignored", () => {
    const odd: Book = JSON.parse(JSON.stringify(book));
    const tokens = odd.chapters[0]?.paragraphs[0]?.[0]?.tokens;
    if (tokens?.[0]) tokens[0].surf = "constructor";
    if (tokens?.[1]) tokens[1].surf = "toString";
    const result = applyLemmas(odd, JSON.parse('{"tostring": 5}'));
    expect(result.chapters[0]?.paragraphs[0]?.[0]?.tokens.map((t) => t.lemma)).toEqual([
      "constructor",
      "tostring",
    ]);
  });
});
