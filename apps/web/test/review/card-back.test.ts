import { describe, expect, test } from "bun:test";
import type { DictEntry } from "@glyphfern/core";
import { MEANING_UNAVAILABLE, cardBack } from "../../src/review/card-back";

const STATIC: DictEntry = {
  pos: "n",
  pronunciation: "/mɛ.zɔ̃/",
  meaning: "ngôi nhà",
  note: "giống cái",
};
const LOOKED_UP: DictEntry = {
  pos: "n",
  pronunciation: "/ʃa/",
  meaning: "cat; tomcat",
  note: "masculine",
};

describe("cardBack", () => {
  test("prefers the static entry over a looked-up one", () => {
    expect(cardBack("maison", STATIC, LOOKED_UP)).toEqual({
      lemma: "maison",
      pronunciation: "/mɛ.zɔ̃/",
      meaning: "ngôi nhà",
      note: "giống cái",
      meaningFound: true,
    });
  });

  test("uses the looked-up entry when there is no static entry", () => {
    expect(cardBack("chat", undefined, LOOKED_UP)).toEqual({
      lemma: "chat",
      pronunciation: "/ʃa/",
      meaning: "cat; tomcat",
      note: "masculine",
      meaningFound: true,
    });
  });

  test("carries no note when the entry has none", () => {
    const withoutNote: DictEntry = { ...LOOKED_UP, note: undefined };
    expect(cardBack("chat", undefined, withoutNote).note).toBeUndefined();
  });

  test("falls back to the lemma and the not-found line without any entry", () => {
    expect(cardBack("zzz", undefined, undefined)).toEqual({
      lemma: "zzz",
      pronunciation: "",
      meaning: MEANING_UNAVAILABLE,
      note: undefined,
      meaningFound: false,
    });
  });

  test("a looked-up entry without glosses shows the not-found line but keeps its pronunciation", () => {
    const back = cardBack("chat", undefined, { ...LOOKED_UP, meaning: "" });
    expect(back.meaning).toBe(MEANING_UNAVAILABLE);
    expect(back.meaningFound).toBe(false);
    expect(back.pronunciation).toBe("/ʃa/");
  });

  test("the not-found line is the Vietnamese UI text", () => {
    expect(MEANING_UNAVAILABLE).toBe("Chưa tra được nghĩa");
  });
});
