import type { LanguagePack } from "@glyphfern/core";
import { buildBook, buildDictionary } from "../buildBook";
import { koRawChapters } from "./book";
import { koRawDictionary } from "./dictionary";
import { koNotes } from "./notes";
import { koKnownLemmas, koLearningLemmas } from "./starter";

export const koPack: LanguagePack = {
  lang: "ko",
  ttsLocale: "ko-KR",
  pronunciationKind: "romanization",
  wordBreak: "keep-all",
  hyphenate: false,
  book: buildBook({
    id: "ppalgan-moja",
    title: "빨간 모자",
    lang: "ko",
    chapters: koRawChapters,
    notes: koNotes,
  }),
  dict: buildDictionary(koRawDictionary),
  knownLemmas: koKnownLemmas,
  learningLemmas: koLearningLemmas,
};
