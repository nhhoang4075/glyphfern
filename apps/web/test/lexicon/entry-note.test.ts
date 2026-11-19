import { describe, expect, test } from "bun:test";
import { type EntryFacts, buildNote } from "../../src/lexicon/entry-note";
import { type LookupResult, toDictEntry } from "../../src/lexicon/lexicon-client";

const NONE: EntryFacts = {
  gender: [],
  number: [],
  plural: [],
  feminine: [],
  senseLabels: [],
  alternations: [],
  irregular: false,
  unusualForms: [],
};

describe("entry notes", () => {
  test("a noun note gives gender, plural, feminine form and labelled senses", () => {
    const facts: EntryFacts = {
      ...NONE,
      gender: ["masculine"],
      plural: ["zorros"],
      feminine: ["zorra"],
      senseLabels: [[], ["figuratively", "colloquial", "Mexico", "Chile"]],
    };
    expect(buildNote(facts, ["fox (carnivore)", "fox (sly or cunning person)"])).toBe(
      "Giống đực. Số nhiều: zorros. Giống cái: zorra. “fox (sly or cunning person)”: nghĩa bóng, khẩu ngữ, dùng ở Mexico, Chile.",
    );
  });

  test("gender depends on the person or on the sense when tags say so", () => {
    expect(buildNote({ ...NONE, gender: ["by-personal-gender"] }, [])).toBe(
      "Giống đực hoặc cái tùy người.",
    );
    expect(buildNote({ ...NONE, gender: ["masculine", "feminine"] }, [])).toBe(
      "Giống đực hoặc cái tùy nghĩa.",
    );
  });

  test("a verb note names irregularity, the stem change and the unusual forms", () => {
    expect(
      buildNote(
        {
          ...NONE,
          irregular: true,
          alternations: ["e-ie", "c-z", "i-í", "hard-soft"],
          unusualForms: ["tengo", "tuve"],
        },
        [],
      ),
    ).toBe(
      "Động từ bất quy tắc. Biến âm thân từ e→ie. Đổi chính tả c→z. Đổi dấu nhấn i→í. Dạng chia khác thường: tengo, tuve.",
    );
  });

  test("number tags and unknown labels", () => {
    expect(
      buildNote({ ...NONE, number: ["plural-only"], senseLabels: [["unknown-tag"]] }, ["x"]),
    ).toBe("Chỉ dùng số nhiều.");
  });

  test("long glosses are shortened inside the quote", () => {
    const note = buildNote({ ...NONE, senseLabels: [["slang"]] }, ["a".repeat(60)]);
    expect(note).toBe(`“${"a".repeat(39)}…”: tiếng lóng.`);
  });

  test("no facts, no note", () => {
    expect(buildNote(null, ["x"])).toBeUndefined();
    expect(buildNote(NONE, ["x"])).toBeUndefined();
  });

  test("a lookup result carries the note into the dictionary entry", () => {
    const result: LookupResult = {
      surface: "zorros",
      lemma: "zorro",
      entries: [
        {
          lemma: "zorro",
          pos: "noun",
          ipa: null,
          glosses: ["fox (carnivore)"],
          facts: { ...NONE, gender: ["masculine"], plural: ["zorros"] },
        },
      ],
    };
    expect(toDictEntry(result)?.note).toBe("Giống đực. Số nhiều: zorros.");
  });
});
