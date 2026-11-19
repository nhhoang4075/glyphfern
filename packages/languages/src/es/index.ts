import type { LanguagePack } from "@glyphfern/core";
import { buildBook, buildDictionary } from "../buildBook";
import { esRawChapters } from "./book";
import { esRawDictionary } from "./dictionary";
import { expandPos } from "./expandPos";
import { esNotes } from "./notes";
import { esKnownLemmas, esLearningLemmas } from "./starter";

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
  knownLemmas: esKnownLemmas,
  learningLemmas: esLearningLemmas,
};

export { expandPos };
