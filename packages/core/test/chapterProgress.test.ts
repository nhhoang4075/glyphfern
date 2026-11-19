import { describe, expect, test } from "bun:test";
import { chapterProgress, nextChapterStartPage } from "../src/chapterProgress";

describe("chapter progress", () => {
  test("is 0 before the chapter starts", () => {
    expect(chapterProgress(1, 5, 10)).toBe(0);
  });

  test("is the fraction of pages behind the current page", () => {
    expect(chapterProgress(6, 5, 10)).toBe(0.4);
    expect(chapterProgress(8, 5, 10)).toBe(0.8);
  });

  test("counts the current page as read", () => {
    expect(chapterProgress(4, 0, 10)).toBe(0.5);
  });

  test("is clamped to 1 once the next chapter is reached", () => {
    expect(chapterProgress(10, 5, 10)).toBe(1);
    expect(chapterProgress(30, 5, 10)).toBe(1);
  });

  test("is clamped to 0 when the page is before the chapter start", () => {
    expect(chapterProgress(0, 5, 10)).toBe(0);
  });

  test("a chapter with a zero-page span uses a divisor of 1", () => {
    expect(chapterProgress(5, 5, 5)).toBe(1);
    expect(chapterProgress(4, 5, 5)).toBe(0);
  });
});

describe("next chapter start page", () => {
  test("uses the start page of the following chapter", () => {
    expect(nextChapterStartPage([0, 4, 9], 0, 20)).toBe(4);
    expect(nextChapterStartPage([0, 4, 9], 1, 20)).toBe(9);
  });

  test("the last chapter ends at the total page count", () => {
    expect(nextChapterStartPage([0, 4, 9], 2, 20)).toBe(20);
  });
});
