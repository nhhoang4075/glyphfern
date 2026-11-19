import { describe, expect, test } from "bun:test";
import { buildReviewQueue } from "../../src/review/review-queue";

describe("buildReviewQueue", () => {
  test("keeps every card in order, whether or not its lemma has a static entry", () => {
    const cards = [
      { lemma: "maison", sentenceId: 1 },
      { lemma: "chat", sentenceId: 2 },
      { lemma: "obscurcir", sentenceId: 3 },
    ];
    expect(buildReviewQueue(cards)).toEqual(["maison", "chat", "obscurcir"]);
  });

  test("is empty without cards", () => {
    expect(buildReviewQueue([])).toEqual([]);
  });
});
