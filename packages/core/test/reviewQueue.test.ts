import { describe, expect, test } from "bun:test";
import { rateReviewCard, reviewProgress } from "../src/reviewQueue";
import type { WordState } from "../src/types";

const LEARNING_3: WordState = { kind: "learning", level: 3 };
const LEARNING_1: WordState = { kind: "learning", level: 1 };

describe("review queue", () => {
  test("again moves the current lemma to the end of the queue", () => {
    const result = rateReviewCard(["a", "b", "c", "d"], "again", LEARNING_3);
    expect(result.queue).toEqual(["b", "c", "d", "a"]);
  });

  test("hard reinserts the current lemma at index 2", () => {
    const result = rateReviewCard(["a", "b", "c", "d", "e"], "hard", LEARNING_3);
    expect(result.queue).toEqual(["b", "c", "a", "d", "e"]);
  });

  test("hard uses the shorter remaining length when fewer than two cards remain", () => {
    expect(rateReviewCard(["a", "b"], "hard", LEARNING_3).queue).toEqual(["b", "a"]);
    expect(rateReviewCard(["a"], "hard", LEARNING_3).queue).toEqual(["a"]);
  });

  test("hard on a queue of two reinserts at the end of the remaining cards", () => {
    expect(rateReviewCard(["a", "b", "c"], "hard", LEARNING_3).queue).toEqual(["b", "c", "a"]);
  });

  test("good removes the current lemma from the front", () => {
    expect(rateReviewCard(["a", "b", "c"], "good", LEARNING_3).queue).toEqual(["b", "c"]);
  });

  test("easy removes the current lemma from the front", () => {
    expect(rateReviewCard(["a", "b", "c"], "easy", LEARNING_3).queue).toEqual(["b", "c"]);
  });

  test("an empty queue stays empty and keeps the state", () => {
    expect(rateReviewCard([], "good", LEARNING_1)).toEqual({ queue: [], state: LEARNING_1 });
  });

  test("the rating also returns the new word state from onRated", () => {
    expect(rateReviewCard(["a"], "good", LEARNING_3).state).toEqual({
      kind: "learning",
      level: 2,
    });
    expect(rateReviewCard(["a"], "easy", LEARNING_1).state).toEqual({ kind: "known" });
    expect(rateReviewCard(["a"], "again", LEARNING_3).state).toEqual(LEARNING_3);
    expect(rateReviewCard(["a"], "hard", LEARNING_3).state).toEqual(LEARNING_3);
  });

  test("the input queue is not mutated", () => {
    const queue = ["a", "b", "c"];
    rateReviewCard(queue, "again", LEARNING_3);
    expect(queue).toEqual(["a", "b", "c"]);
  });
});

describe("review progress", () => {
  test("done is total minus the remaining queue length", () => {
    expect(reviewProgress(10, ["a", "b", "c"])).toEqual({ done: 7, total: 10 });
  });

  test("a full queue means nothing is done", () => {
    expect(reviewProgress(3, ["a", "b", "c"])).toEqual({ done: 0, total: 3 });
  });

  test("an empty queue means everything is done", () => {
    expect(reviewProgress(3, [])).toEqual({ done: 3, total: 3 });
  });
});
