import type { LanguagePack } from "@glyphfern/core";
import { buildBook, buildDictionary } from "../build-book";
import { esRawChapters } from "./book";
import { esRawDictionary } from "./dictionary";
import { expandPos } from "./expand-pos";
import { esNotes } from "./notes";

export const esPack: LanguagePack = {
  lang: "es",
  ttsLocale: "es-ES",
  pronunciationKind: "ipa",
  wordBreak: "normal",
  hyphenate: true,
  book: buildBook({
    id: "la-nina-y-el-lobo",
    title: "La niña y el lobo",
    lang: "es",
    chapters: esRawChapters,
    notes: esNotes,
  }),
  dict: buildDictionary(esRawDictionary, expandPos),
};

export { expandPos };
