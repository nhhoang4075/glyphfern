import { expect, test } from "bun:test";
import { coverage } from "../src/coverage";
import type { Sentence, Token, WordState } from "../src/types";

function token(lemma: string): Token {
  return { lead: "", surf: lemma, trail: "", lemma };
}

function sentence(id: number, lemmas: string[]): Sentence {
  return { id, chapter: 0, kind: "body", tokens: lemmas.map(token) };
}

const STATES: Record<string, WordState> = {
  conocer: { kind: "known" },
  casa: { kind: "known" },
  gato: { kind: "learning", level: 2 },
  perro: { kind: "learning", level: 3 },
};

function stateOf(lemma: string): WordState {
  return STATES[lemma] ?? { kind: "new" };
}

test("percent is known tokens divided by all tokens, rounded", () => {
  const sentences = [sentence(1, ["conocer", "casa", "gato"]), sentence(2, ["perro", "luna"])];
  const result = coverage(sentences, stateOf, 0);
  expect(result.percent).toBe(40);
});

test("percent rounds to the nearest integer", () => {
  const sentences = [sentence(1, ["conocer", "luna", "sol"])];
  expect(coverage(sentences, stateOf, 0).percent).toBe(33);
  const twoOfThree = [sentence(1, ["conocer", "casa", "sol"])];
  expect(coverage(twoOfThree, stateOf, 0).percent).toBe(67);
});

test("repeated known tokens count once per occurrence in the percent", () => {
  const sentences = [sentence(1, ["casa", "casa", "luna", "luna"])];
  expect(coverage(sentences, stateOf, 0).percent).toBe(50);
});

test("new and learning lemmas are counted as distinct lemmas", () => {
  const sentences = [
    sentence(1, ["luna", "luna", "sol", "gato", "gato"]),
    sentence(2, ["sol", "perro", "perro", "conocer"]),
  ];
  const result = coverage(sentences, stateOf, 0);
  expect(result.newLemmas).toBe(2);
  expect(result.learningLemmas).toBe(2);
});

test("cards is the card count passed in", () => {
  const sentences = [sentence(1, ["casa"])];
  expect(coverage(sentences, stateOf, 7).cards).toBe(7);
});

test("an empty book has zero coverage and no lemmas", () => {
  expect(coverage([], stateOf, 0)).toEqual({
    percent: 0,
    newLemmas: 0,
    learningLemmas: 0,
    cards: 0,
  });
});

test("unmatched tokens are excluded from percent, new and learning counts", () => {
  const unmatchedToken = (lemma: string): Token => ({ ...token(lemma), unmatched: true });
  const sentences: Sentence[] = [
    {
      id: 1,
      chapter: 0,
      kind: "body",
      tokens: [token("casa"), token("luna"), unmatchedToken("morgan"), unmatchedToken("gato")],
    },
  ];
  expect(coverage(sentences, stateOf, 0)).toEqual({
    percent: 50,
    newLemmas: 1,
    learningLemmas: 0,
    cards: 0,
  });
});
