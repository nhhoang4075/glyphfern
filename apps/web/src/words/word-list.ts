import type { Book, WordState } from "@glyphfern/core";
import { indexBook } from "../app/book-index";

export type WordFilter = "learning" | "known";

export interface WordRow {
  lemma: string;
  sentenceId: number;
  state: WordState;
}

export function buildWordRows(
  book: Book,
  stateOf: (lemma: string) => WordState,
  filter: WordFilter,
): WordRow[] {
  const seen = new Set<string>();
  const rows: WordRow[] = [];
  for (const sentence of indexBook(book).sentences) {
    for (const token of sentence.tokens) {
      if (seen.has(token.lemma)) {
        continue;
      }
      const state = stateOf(token.lemma);
      if (state.kind === filter) {
        seen.add(token.lemma);
        rows.push({ lemma: token.lemma, sentenceId: sentence.id, state });
      }
    }
  }
  return rows;
}

export function glowClass(state: WordState): string {
  if (state.kind === "known") {
    return "k";
  }
  if (state.kind === "learning") {
    return `l${state.level}`;
  }
  return "";
}
