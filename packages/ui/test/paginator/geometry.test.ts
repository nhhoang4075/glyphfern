import { describe, expect, test } from "bun:test";
import {
  chapterPageOf,
  clampPage,
  endPageOf,
  gapFor,
  pageCount,
  pageSentence,
  progressRatio,
  sentenceAtPage,
  startPageOf,
  step,
} from "../../src/paginator/geometry";

describe("gapFor", () => {
  test("is 20 percent of the width", () => {
    expect(gapFor(500)).toBe(100);
  });
  test("rounds to the nearest pixel", () => {
    expect(gapFor(333)).toBe(67);
    expect(gapFor(332)).toBe(66);
  });
});

describe("step", () => {
  test("adds the gap to the width", () => {
    expect(step(500, 100)).toBe(600);
  });
});

describe("pageCount", () => {
  test("three pages of 500 with gap 100 scroll 1700 wide", () => {
    expect(pageCount(1700, 100, 600)).toBe(3);
  });
  test("a single short page is one page", () => {
    expect(pageCount(500, 100, 600)).toBe(1);
  });
  test("never drops below one", () => {
    expect(pageCount(0, 0, 600)).toBe(1);
  });
  test("rounds a fractional result", () => {
    expect(pageCount(1701, 100, 600)).toBe(3);
    expect(pageCount(2000, 100, 600)).toBe(4);
  });
});

describe("startPageOf", () => {
  test("a rect at the flow origin starts on page 0", () => {
    expect(startPageOf(1000, 1000, 600)).toBe(0);
  });
  test("a rect 3px before the second column is still page 0", () => {
    expect(startPageOf(1597, 1000, 600)).toBe(0);
  });
  test("a rect 2px before the second column is pushed into page 1 by the tolerance", () => {
    expect(startPageOf(1598, 1000, 600)).toBe(1);
  });
  test("a rect in the third column", () => {
    expect(startPageOf(2300, 1000, 600)).toBe(2);
  });
  test("a rect left of the flow clamps to 0", () => {
    expect(startPageOf(900, 1000, 600)).toBe(0);
  });
});

describe("endPageOf", () => {
  test("a rect ending inside the first column ends on page 0", () => {
    expect(endPageOf(1400, 1000, 600, 0)).toBe(0);
  });
  test("a rect ending 1px past the boundary stays on the page through tolerance", () => {
    expect(endPageOf(1601, 1000, 600, 0)).toBe(0);
  });
  test("a rect ending 3px past the boundary spills to the next page", () => {
    expect(endPageOf(1603, 1000, 600, 0)).toBe(1);
  });
  test("never ends before it starts", () => {
    expect(endPageOf(1001, 1000, 600, 1)).toBe(1);
  });
});

describe("chapterPageOf", () => {
  test("a heading at the flow origin is page 0", () => {
    expect(chapterPageOf(1000, 1000, 600)).toBe(0);
  });
  test("a heading at the start of the third column is page 2", () => {
    expect(chapterPageOf(2200, 1000, 600)).toBe(2);
  });
  test("a heading 1px short of a column start is page 2 through tolerance", () => {
    expect(chapterPageOf(2199, 1000, 600)).toBe(2);
  });
  test("a heading 3px short of a column start stays on page 1", () => {
    expect(chapterPageOf(2197, 1000, 600)).toBe(1);
  });
});

const ranges = [
  { startPage: 0, endPage: 0 },
  { startPage: 0, endPage: 1 },
  { startPage: 1, endPage: 1 },
  { startPage: 2, endPage: 3 },
];

describe("pageSentence", () => {
  test("page 0 maps to the first sentence", () => {
    expect(pageSentence(ranges, 0)).toBe(0);
  });
  test("page 1 maps to the first sentence ending on or after it", () => {
    expect(pageSentence(ranges, 1)).toBe(1);
  });
  test("page 2 maps to the sentence that starts there", () => {
    expect(pageSentence(ranges, 2)).toBe(3);
  });
  test("a page beyond every sentence falls back to 0", () => {
    expect(pageSentence(ranges, 9)).toBe(0);
  });
  test("an empty list falls back to 0", () => {
    expect(pageSentence([], 3)).toBe(0);
  });
});

describe("sentenceAtPage", () => {
  test("page 0 maps to the first sentence", () => {
    expect(sentenceAtPage(ranges, 0)).toBe(0);
  });
  test("page 1 maps to the first sentence spanning it", () => {
    expect(sentenceAtPage(ranges, 1)).toBe(1);
  });
  test("page 3 is spanned by the last sentence", () => {
    expect(sentenceAtPage(ranges, 3)).toBe(3);
  });
  test("a page nobody spans falls back to 0", () => {
    const gappy = [
      { startPage: 0, endPage: 0 },
      { startPage: 2, endPage: 2 },
    ];
    expect(sentenceAtPage(gappy, 1)).toBe(0);
  });
  test("an empty list falls back to 0", () => {
    expect(sentenceAtPage([], 1)).toBe(0);
  });
});

describe("clampPage", () => {
  test("keeps an in-range page", () => {
    expect(clampPage(2, 5)).toBe(2);
  });
  test("clamps below zero", () => {
    expect(clampPage(-3, 5)).toBe(0);
  });
  test("clamps above the last page", () => {
    expect(clampPage(9, 5)).toBe(4);
  });
  test("a single page clamps everything to 0", () => {
    expect(clampPage(4, 1)).toBe(0);
  });
});

describe("progressRatio", () => {
  test("is 0 on the first page", () => {
    expect(progressRatio(0, 11)).toBe(0);
  });
  test("is 1 on the last page", () => {
    expect(progressRatio(10, 11)).toBe(1);
  });
  test("is page over pages minus one", () => {
    expect(progressRatio(5, 11)).toBe(0.5);
    expect(progressRatio(1, 5)).toBe(0.25);
  });
  test("is 0 when there is a single page", () => {
    expect(progressRatio(0, 1)).toBe(0);
  });
});
