import { describe, expect, test } from "bun:test";
import { parseKaikkiLine } from "../../src/lexicon/parse-kaikki";
import { KAIKKI_LINES } from "./fixture";

const [MIRAR, MIRABA, COMO_ADV, COMO_VERB, , HOUSE, BROKEN, EMPTY] = KAIKKI_LINES as [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
];

describe("parsing a kaikki line", () => {
  test("an entry gets its glosses, with deprecated senses dropped", () => {
    expect(parseKaikkiLine(MIRAR, "es")).toEqual({
      word: "mirar",
      pos: "verb",
      ipa: "/miˈɾaɾ/",
      glosses: ["to look at", "to watch"],
      lemma: null,
    });
  });

  test("an entry made only of form-of senses becomes a pointer to its lemma", () => {
    expect(parseKaikkiLine(MIRABA, "es")).toEqual({
      word: "miraba",
      pos: "verb",
      ipa: null,
      glosses: [],
      lemma: "mirar",
    });
    expect(parseKaikkiLine(COMO_VERB, "es")?.lemma).toBe("comer");
    expect(parseKaikkiLine(COMO_ADV, "es")?.lemma).toBeNull();
  });

  test("other languages, broken lines and entries without senses are skipped", () => {
    expect(parseKaikkiLine(HOUSE, "es")).toBeUndefined();
    expect(parseKaikkiLine(BROKEN, "es")).toBeUndefined();
    expect(parseKaikkiLine(EMPTY, "es")).toBeUndefined();
  });
});
