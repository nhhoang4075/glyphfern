import { type LanguagePack, type WordState, tapKnown } from "@glyphfern/core";
import type { Card } from "../app/api";
import { firstOccurrence } from "../app/bookIndex";
import type { LanguageSnapshot, Repository } from "./repository";

export function buildStarterSnapshot(pack: LanguagePack): LanguageSnapshot {
  const states: Record<string, WordState> = {};
  for (const lemma of pack.knownLemmas) {
    states[lemma] = tapKnown();
  }
  const cards: Card[] = [];
  for (const [lemma, level] of Object.entries(pack.learningLemmas)) {
    states[lemma] = { kind: "learning", level };
    const sentence = firstOccurrence(pack.book, lemma);
    if (sentence) {
      cards.push({ lemma, sentenceId: sentence.id });
    }
  }
  return { states, cards, bookmarks: [] };
}

export async function ensureLanguage(
  repository: Repository,
  pack: LanguagePack,
): Promise<LanguageSnapshot> {
  if (!(await repository.isSeeded(pack.lang))) {
    await repository.seedLanguage(pack.lang, buildStarterSnapshot(pack));
  }
  return repository.loadLanguage(pack.lang);
}
