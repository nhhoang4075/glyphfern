import { EMPTY_BOOK, type LanguagePack } from "@glyphfern/core";
import { buildDictionary } from "../build-dictionary";
import { esRawDictionary } from "./dictionary";
import { expandPos } from "./expand-pos";

export const esPack: LanguagePack = {
  lang: "es",
  ttsLocale: "es-ES",
  pronunciationKind: "ipa",
  wordBreak: "normal",
  hyphenate: true,
  book: EMPTY_BOOK,
  dict: buildDictionary(esRawDictionary, expandPos),
};

export { expandPos };
