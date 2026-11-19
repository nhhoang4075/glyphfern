import { expect, test } from "bun:test";
import { search } from "../src/search";
import type { Sentence, Token } from "../src/types";

function token(surf: string, lemma: string): Token {
  return { lead: "", surf, trail: "", lemma };
}

const SENTENCES: Sentence[] = [
  {
    id: 10,
    chapter: 1,
    kind: "body",
    tokens: [token("Había", "haber"), token("una", "un"), token("Casa", "casa")],
  },
  {
    id: 11,
    chapter: 1,
    kind: "body",
    tokens: [token("hablaban", "hablar"), token("mucho", "mucho")],
  },
  {
    id: 12,
    chapter: 1,
    kind: "body",
    tokens: [token("sol", "sol")],
  },
];

test("an empty or whitespace query returns no results", () => {
  expect(search(SENTENCES, "")).toEqual([]);
  expect(search(SENTENCES, "   ")).toEqual([]);
});

test("search is case-insensitive on the query", () => {
  expect(search(SENTENCES, "CASA")).toEqual([{ sentenceId: 10, tokenIndexes: [2] }]);
});

test("a token matches when its lowercased surface equals the query", () => {
  expect(search(SENTENCES, "había")).toEqual([{ sentenceId: 10, tokenIndexes: [0] }]);
});

test("a token matches when its lemma equals the query", () => {
  expect(search(SENTENCES, "haber")).toEqual([{ sentenceId: 10, tokenIndexes: [0] }]);
});

test("a token matches when its lemma or surface starts with the query", () => {
  expect(search(SENTENCES, "habla")).toEqual([{ sentenceId: 11, tokenIndexes: [0] }]);
});

test("a query that is a prefix of a token only matches from the start", () => {
  expect(search(SENTENCES, " casa")).toEqual([{ sentenceId: 10, tokenIndexes: [2] }]);
  expect(search(SENTENCES, "asa")).toEqual([]);
});

test("every matching token index is returned for each sentence", () => {
  const sentences: Sentence[] = [
    {
      id: 20,
      chapter: 2,
      kind: "body",
      tokens: [
        token("mar", "mar"),
        token("marea", "marea"),
        token("sol", "sol"),
        token("Mar", "mar"),
      ],
    },
  ];
  expect(search(sentences, "mar")).toEqual([{ sentenceId: 20, tokenIndexes: [0, 1, 3] }]);
});

test("sentences without a match are omitted", () => {
  expect(search(SENTENCES, "sol")).toEqual([{ sentenceId: 12, tokenIndexes: [0] }]);
  expect(search(SENTENCES, "zzz")).toEqual([]);
});

test("the query is trimmed before matching", () => {
  expect(search(SENTENCES, "  sol  ")).toEqual([{ sentenceId: 12, tokenIndexes: [0] }]);
});
