import type { Lang, LanguagePack } from "@glyphfern/core";
import { esPack } from "./es";

export { buildDictionary } from "./build-dictionary";
export type { RawDictTuple } from "./build-dictionary";
export { expandPos } from "./es/expand-pos";
export { esPack };

export const packs: Record<Lang, LanguagePack> = {
  es: esPack,
};
