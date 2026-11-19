import type { Lang, LanguagePack } from "@glyphfern/core";
import { esPack } from "./es";
import { koPack } from "./ko";

export { buildBook, buildDictionary, parseToken, parseTokens } from "./build-book";
export type { BookSource, RawChapter, RawDictTuple, RawSentence } from "./build-book";
export { expandPos } from "./es/expand-pos";
export { esPack, koPack };

export const packs: Record<Lang, LanguagePack> = {
  es: esPack,
  ko: koPack,
};
