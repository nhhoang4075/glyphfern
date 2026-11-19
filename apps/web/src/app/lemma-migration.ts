import type { Book, Token, WordState } from "@glyphfern/core";
import type { Card } from "./api";

export type LemmaChanges = ReadonlyMap<string, string>;

export interface Progress {
  readonly states: Readonly<Record<string, WordState>>;
  readonly cards: readonly Card[];
}

export interface ProgressMigration {
  states: Record<string, WordState>;
  cards: Card[];
  copiedStates: Array<{ lemma: string; state: WordState }>;
  deletedCards: string[];
  savedCards: Card[];
}

function tokensOf(book: Book): Token[] {
  return book.chapters.flatMap((chapter) =>
    [chapter.title, ...chapter.paragraphs.flat()].flatMap((sentence) => sentence.tokens),
  );
}

export function lemmaChanges(before: Book, after: Book): Map<string, string> {
  const changes = new Map<string, string>();
  const afterTokens = tokensOf(after);
  tokensOf(before).forEach((token, index) => {
    const next = afterTokens[index]?.lemma;
    if (next !== undefined && next !== token.lemma && !changes.has(token.lemma)) {
      changes.set(token.lemma, next);
    }
  });
  return changes;
}

export function migrateProgress(
  progress: Progress,
  changes: LemmaChanges,
  inBook: (sentenceId: number) => boolean,
): ProgressMigration {
  const isMoving = (card: Card) => inBook(card.sentenceId) && changes.has(card.lemma);
  const occupied = new Set(progress.cards.filter((card) => !isMoving(card)).map((c) => c.lemma));
  const deletedCards: string[] = [];
  const savedCards: Card[] = [];
  const cards: Card[] = [];
  for (const card of progress.cards) {
    const target = isMoving(card) ? changes.get(card.lemma) : undefined;
    if (target === undefined) {
      cards.push(card);
      continue;
    }
    deletedCards.push(card.lemma);
    if (!occupied.has(target)) {
      occupied.add(target);
      const moved: Card = { lemma: target, sentenceId: card.sentenceId };
      cards.push(moved);
      savedCards.push(moved);
    }
  }
  const states = { ...progress.states };
  const copiedStates: ProgressMigration["copiedStates"] = [];
  for (const [oldLemma, newLemma] of changes) {
    const state = progress.states[oldLemma];
    if (state !== undefined && progress.states[newLemma] === undefined) {
      states[newLemma] = state;
      copiedStates.push({ lemma: newLemma, state });
    }
  }
  return { states, cards, copiedStates, deletedCards, savedCards };
}
