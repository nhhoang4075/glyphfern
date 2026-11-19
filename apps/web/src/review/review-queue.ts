import type { ReviewProgress, Sentence } from "@glyphfern/core";

export interface ReviewSession {
  queue: string[];
  total: number;
}

export const EMPTY_SESSION: ReviewSession = { queue: [], total: 0 };

export function startSession(queue: readonly string[]): ReviewSession {
  return { queue: [...queue], total: queue.length };
}

export function sessionWithQueue(session: ReviewSession, queue: readonly string[]): ReviewSession {
  return { queue: [...queue], total: session.total };
}

export function startOfLocalDay(time: number): number {
  const date = new Date(time);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
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
