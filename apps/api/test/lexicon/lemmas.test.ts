import { describe, expect, test } from "bun:test";
import { type FormRow, resolveLemmas } from "../../src/lexicon/lemmas";

const rows: FormRow[] = [
  { word: "miraba", lemma: "mirar" },
  { word: "como", lemma: null },
  { word: "como", lemma: "comer" },
  { word: "lobo", lemma: null },
];

const store = {
  async findForms(_lang: string, words: readonly string[]) {
    return rows.filter((row) => words.includes(row.word));
  },
};

describe("bulk lemma resolution", () => {
  test("forms map to their lemma, case-insensitively", async () => {
    expect(await resolveLemmas(store, "es", ["Miraba"])).toEqual({
      lemmas: { miraba: "mirar" },
      unknown: [],
    });
  });

  test("a word that is also a dictionary entry keeps itself", async () => {
    expect(await resolveLemmas(store, "es", ["como", "lobo"])).toEqual({ lemmas: {}, unknown: [] });
  });

  test("a word with no forms row is unknown, lowercased and listed once", async () => {
    const result = await resolveLemmas(store, "es", ["Morgan", "morgan", "lobo", "zzz"]);
    expect(result.unknown).toEqual(["morgan", "zzz"]);
  });

  test("a known word that maps to itself is not unknown and not in lemmas", async () => {
    const result = await resolveLemmas(store, "es", ["lobo"]);
    expect(result).toEqual({ lemmas: {}, unknown: [] });
  });
});
