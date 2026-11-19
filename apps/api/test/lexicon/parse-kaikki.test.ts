import { describe, expect, test } from "bun:test";
import { parseKaikkiLine } from "../../src/lexicon/parse-kaikki";
import { KAIKKI_LINES } from "./fixture";

const [MIRAR, MIRABA, COMO_ADV, COMO_VERB, , HOUSE, BROKEN, EMPTY, ZORRO, PEDIR, IR, BUSCAR] =
  KAIKKI_LINES as [
    string,
    string,
    string,
    string,
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
      facts: null,
    });
  });

  test("an entry made only of form-of senses becomes a pointer to its lemma", () => {
    expect(parseKaikkiLine(MIRABA, "es")).toEqual({
      word: "miraba",
      pos: "verb",
      ipa: null,
      glosses: [],
      lemma: "mirar",
      facts: null,
    });
    expect(parseKaikkiLine(COMO_VERB, "es")?.lemma).toBe("comer");
    expect(parseKaikkiLine(COMO_ADV, "es")?.lemma).toBeNull();
  });

  test("other languages, broken lines and entries without senses are skipped", () => {
    expect(parseKaikkiLine(HOUSE, "es")).toBeUndefined();
    expect(parseKaikkiLine(BROKEN, "es")).toBeUndefined();
    expect(parseKaikkiLine(EMPTY, "es")).toBeUndefined();
  });

  test("a noun carries gender, plural, feminine form and per-sense usage labels", () => {
    const facts = parseKaikkiLine(ZORRO, "es")?.facts;
    expect(facts?.gender).toEqual(["masculine"]);
    expect(facts?.plural).toEqual(["zorros"]);
    expect(facts?.feminine).toEqual(["zorra"]);
    expect(facts?.senseLabels).toEqual([[], ["figuratively", "colloquial", "Mexico"]]);
  });

  test("a verb lists only the key forms that differ from the regular pattern", () => {
    expect(parseKaikkiLine(PEDIR, "es")?.facts).toMatchObject({
      alternations: ["e-i"],
      irregular: false,
      unusualForms: ["pido", "pidió", "pidiendo"],
    });
    expect(parseKaikkiLine(IR, "es")?.facts).toMatchObject({
      irregular: true,
      unusualForms: ["voy", "fui", "fue", "yendo"],
    });
    expect(parseKaikkiLine(BUSCAR, "es")?.facts).toMatchObject({
      alternations: ["c-qu"],
      unusualForms: ["busqué"],
    });
  });
});
