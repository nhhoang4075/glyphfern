import type { Lang } from "./types";

export function stateKey(lang: Lang, lemma: string): string {
  return `${lang}:${lemma}`;
}
