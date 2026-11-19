import type { Rating, WordState } from "./types";
import { onRated } from "./word-state";

const HARD_REINSERT_INDEX = 2;

export interface ReviewRatingResult {
  queue: string[];
  state: WordState;
}

export interface ReviewProgress {
  done: number;
  total: number;
}

export function rateReviewCard(
  queue: readonly string[],
  rating: Rating,
  state: WordState,
): ReviewRatingResult {
  const [currentLemma, ...rest] = queue;
  if (currentLemma === undefined) {
    return { queue: [], state };
  }
  return {
    queue: queueAfterRating(currentLemma, rest, rating),
    state: onRated(state, rating),
  };
}

function queueAfterRating(currentLemma: string, rest: string[], rating: Rating): string[] {
  if (rating === "again") {
    return [...rest, currentLemma];
  }
  if (rating === "hard") {
    const insertIndex = Math.min(HARD_REINSERT_INDEX, rest.length);
    return [...rest.slice(0, insertIndex), currentLemma, ...rest.slice(insertIndex)];
  }
  return rest;
}

export function reviewProgress(total: number, queue: readonly string[]): ReviewProgress {
  return { done: total - queue.length, total };
}
