import type { Lang, LanguagePack } from "@glyphfern/core";
import { esPack } from "./es";
import { koPack } from "./ko";

export { buildBook, buildDictionary, parseToken, parseTokens } from "./buildBook";
export type { BookSource, RawChapter, RawDictTuple, RawSentence } from "./buildBook";
export { expandPos } from "./es/expandPos";
export { esPack, koPack };

export const packs: Record<Lang, LanguagePack> = {
  es: esPack,
  ko: koPack,
};
