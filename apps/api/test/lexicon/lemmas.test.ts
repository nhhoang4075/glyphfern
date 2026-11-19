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
    expect(await resolveLemmas(store, "es", ["Miraba"])).toEqual({ miraba: "mirar" });
  });

  test("a word that is also a dictionary entry keeps itself", async () => {
    expect(await resolveLemmas(store, "es", ["como", "lobo", "zzz"])).toEqual({});
  });
});
