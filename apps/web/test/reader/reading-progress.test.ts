import { describe, expect, test } from "bun:test";
import type { Book, Sentence } from "@glyphfern/core";
import {
  chapterWindow,
  hasChapterAfter,
  hasChapterBefore,
  windowWords,
} from "../../src/reader/chapter-window";
import {
  bookProgress,
  chapterWordCounts,
  currentPageNumber,
  estimatedStartPage,
  pageFraction,
  sentenceProgress,
  wordsPerPage,
} from "../../src/reader/reading-progress";

function sentence(id: number, kind: Sentence["kind"], words: number): Sentence {
  return {
    id,
    chapter: 0,
    kind,
    tokens: Array.from({ length: words }, (_, index) => ({
      lead: "",
      surf: `w${index}`,
      trail: "",
      lemma: `w${index}`,
    })),
  };
}

const BOOK: Book = {
  id: "b",
  title: "B",
  lang: "es",
  chapters: [
    { title: sentence(0, "title", 1), paragraphs: [[sentence(1, "body", 9)]] },
    {
      title: sentence(2, "title", 2),
      paragraphs: [[sentence(3, "body", 10), sentence(4, "body", 8)]],
    },
    { title: sentence(5, "title", 1), paragraphs: [[sentence(6, "body", 59)]] },
  ],
};

describe("chapter window", () => {
  test("holds the current chapter and its neighbours", () => {
    expect(chapterWindow(5, 10)).toEqual({ first: 4, last: 6 });
  });

  test("has fewer chapters at the ends of the book", () => {
    expect(chapterWindow(0, 10)).toEqual({ first: 0, last: 1 });
    expect(chapterWindow(9, 10)).toEqual({ first: 8, last: 9 });
  });

  test("clamps a stale centre and handles tiny books", () => {
    expect(chapterWindow(30, 4)).toEqual({ first: 2, last: 3 });
    expect(chapterWindow(0, 1)).toEqual({ first: 0, last: 0 });
    expect(chapterWindow(0, 0)).toEqual({ first: 0, last: 0 });
  });

  test("knows whether the book continues on either side", () => {
    expect(hasChapterBefore({ first: 0, last: 1 })).toBe(false);
    expect(hasChapterBefore({ first: 3, last: 5 })).toBe(true);
    expect(hasChapterAfter({ first: 3, last: 5 }, 6)).toBe(false);
    expect(hasChapterAfter({ first: 3, last: 5 }, 8)).toBe(true);
  });

  test("sums the words of the windowed chapters", () => {
    expect(windowWords([10, 20, 30, 40], { first: 1, last: 2 })).toBe(50);
  });
});

describe("word counts", () => {
  test("count every token of the title and the paragraphs of each chapter", () => {
    expect(chapterWordCounts(BOOK)).toEqual([10, 20, 60]);
  });
});

describe("book progress", () => {
  test("is (words before + fraction * chapter words) / total words", () => {
    expect(bookProgress([10, 20, 60], 1, 0.5)).toBe((10 + 10) / 90);
  });

  test("is 0 at the start of the first chapter", () => {
    expect(bookProgress([10, 20, 60], 0, 0)).toBe(0);
  });

  test("an empty book has no progress", () => {
    expect(bookProgress([], 0, 0.5)).toBe(0);
  });

  test("page fraction is (page - start) / chapter pages, clamped", () => {
    expect(pageFraction(7, 5, 8)).toBe(0.25);
    expect(pageFraction(3, 5, 8)).toBe(0);
    expect(pageFraction(30, 5, 8)).toBe(1);
  });

  test("does not depend on the page size of a layout", () => {
    const small = bookProgress([10, 20, 60], 2, pageFraction(4, 0, 8));
    const large = bookProgress([10, 20, 60], 2, pageFraction(2, 0, 4));
    expect(small).toBe(large);
  });

  test("a saved sentence maps to the words before it", () => {
    expect(sentenceProgress(BOOK, 0)).toBe(0);
    expect(sentenceProgress(BOOK, 2)).toBe(10 / 90);
    expect(sentenceProgress(BOOK, 4)).toBe((10 + 12) / 90);
    expect(sentenceProgress(BOOK, 6)).toBe((30 + 1) / 90);
  });

  test("an unknown sentence has no progress", () => {
    expect(sentenceProgress(BOOK, 99)).toBe(0);
  });
});

describe("estimated chapter pages", () => {
  test("words per page is window words over window pages", () => {
    expect(wordsPerPage(300, 6)).toBe(50);
  });

  test("the start page is round(words before / words per page) + 1", () => {
    expect(estimatedStartPage(0, 50)).toBe(1);
    expect(estimatedStartPage(120, 50)).toBe(3);
    expect(estimatedStartPage(130, 50)).toBe(4);
  });

  test("a layout without words per page falls back to page 1", () => {
    expect(estimatedStartPage(500, 0)).toBe(1);
  });
});

describe("current page number", () => {
  test("is round(words before the page / words per page) + 1", () => {
    expect(currentPageNumber([100, 200, 300], 1, 0.25, 50)).toBe(Math.round(150 / 50) + 1);
  });

  test("is page 1 at the start of the book", () => {
    expect(currentPageNumber([100, 200], 0, 0, 50)).toBe(1);
  });

  test("matches the chapter estimate at the first page of a chapter", () => {
    expect(currentPageNumber([100, 200, 300], 2, 0, 40)).toBe(estimatedStartPage(300, 40));
  });
});
