import type { ReviewLogEntry } from "@glyphfern/core";

export function isFirstReview(entry: ReviewLogEntry): boolean {
  return entry.before === null || entry.before.reps === 0;
}
