import { describe, expect, test } from "bun:test";
import { buildDictionary } from "../src/build-dictionary";

describe("buildDictionary", () => {
  test("maps a raw tuple to a dictionary entry", () => {
    const dict = buildDictionary({ casa: ["dt", "/ˈka.sa/", "nhà", "nota"] });
    expect(dict.casa).toEqual({
      pos: "dt",
      pronunciation: "/ˈka.sa/",
      meaning: "nhà",
      note: "nota",
    });
  });

  test("omits the note field when the note is empty", () => {
    const dict = buildDictionary({ casa: ["dt", "/ˈka.sa/", "nhà", ""] });
    expect(dict.casa).toEqual({ pos: "dt", pronunciation: "/ˈka.sa/", meaning: "nhà" });
  });

  test("passes the part of speech through the normalizer", () => {
    const dict = buildDictionary({ casa: ["dt", "/ˈka.sa/", "nhà", ""] }, (pos) => `${pos}!`);
    expect(dict.casa?.pos).toBe("dt!");
  });
});
