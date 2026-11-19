import { describe, expect, test } from "bun:test";
import { rateReviewCard, reviewProgress } from "../src/review-queue";

describe("review queue", () => {
  test("again moves the current lemma to the end of the queue", () => {
    const result = rateReviewCard(["a", "b", "c", "d"], "again");
    expect(result).toEqual(["b", "c", "d", "a"]);
  });

  test("hard reinserts the current lemma at index 2", () => {
    const result = rateReviewCard(["a", "b", "c", "d", "e"], "hard");
    expect(result).toEqual(["b", "c", "a", "d", "e"]);
  });

  test("hard uses the shorter remaining length when fewer than two cards remain", () => {
    expect(rateReviewCard(["a", "b"], "hard")).toEqual(["b", "a"]);
    expect(rateReviewCard(["a"], "hard")).toEqual(["a"]);
  });

  test("hard on a queue of two reinserts at the end of the remaining cards", () => {
    expect(rateReviewCard(["a", "b", "c"], "hard")).toEqual(["b", "c", "a"]);
  });

  test("good removes the current lemma from the front", () => {
    expect(rateReviewCard(["a", "b", "c"], "good")).toEqual(["b", "c"]);
  });

  test("easy removes the current lemma from the front", () => {
    expect(rateReviewCard(["a", "b", "c"], "easy")).toEqual(["b", "c"]);
  });

  test("an empty queue stays empty", () => {
    expect(rateReviewCard([], "good")).toEqual([]);
  });

  test("the input queue is not mutated", () => {
    const queue = ["a", "b", "c"];
    rateReviewCard(queue, "again");
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
