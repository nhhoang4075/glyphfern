import type { DictEntry, ReviewProgress, Sentence } from "@glyphfern/core";
import type { Card } from "../app/api";

export function buildReviewQueue(
  cards: readonly Card[],
  dict: Readonly<Record<string, DictEntry>>,
): string[] {
  return cards.filter((card) => dict[card.lemma] !== undefined).map((card) => card.lemma);
}

export function sentenceText(sentence: Sentence): string {
  return sentence.tokens.map((token) => `${token.lead}${token.surf}${token.trail}`).join(" ");
}

export interface ProgressDot {
  id: string;
  className: string | undefined;
}

export function progressDots(progress: ReviewProgress): ProgressDot[] {
  const dots: ProgressDot[] = [];
  for (let dotNumber = 0; dotNumber < progress.total; dotNumber += 1) {
    let className: string | undefined;
    if (dotNumber < progress.done) {
      className = "d";
    } else if (dotNumber === progress.done) {
      className = "c";
    }
    dots.push({ id: `dot-${dotNumber}`, className });
  }
  return dots;
}
