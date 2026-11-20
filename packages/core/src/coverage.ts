import type { Sentence, WordState } from "./types";

export interface Coverage {
  percent: number;
  newLemmas: number;
  learningLemmas: number;
  cards: number;
}

export function coverage(
  sentences: readonly Sentence[],
  stateOf: (lemma: string) => WordState,
  cardCount: number,
): Coverage {
  let totalTokens = 0;
  let knownTokens = 0;
  const newLemmas = new Set<string>();
  const learningLemmas = new Set<string>();

  for (const sentence of sentences) {
    for (const token of sentence.tokens) {
      if (token.unmatched) {
        continue;
      }
      totalTokens += 1;
      const state = stateOf(token.lemma);
      if (state.kind === "known") {
        knownTokens += 1;
      } else if (state.kind === "new") {
        newLemmas.add(token.lemma);
      } else {
        learningLemmas.add(token.lemma);
      }
    }
  }

  return {
    percent: totalTokens === 0 ? 0 : Math.round((knownTokens * 100) / totalTokens),
    newLemmas: newLemmas.size,
    learningLemmas: learningLemmas.size,
    cards: cardCount,
  };
}
