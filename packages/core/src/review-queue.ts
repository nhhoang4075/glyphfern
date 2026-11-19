import type { Rating } from "./types";

const HARD_REINSERT_INDEX = 2;

export interface ReviewProgress {
  done: number;
  total: number;
}

export function rateReviewCard(queue: readonly string[], rating: Rating): string[] {
  const [currentLemma, ...rest] = queue;
  if (currentLemma === undefined) {
    return [];
  }
  return queueAfterRating(currentLemma, rest, rating);
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
