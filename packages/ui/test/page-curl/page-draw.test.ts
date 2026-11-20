import { describe, expect, test } from "bun:test";
import {
  SOFT_HYPHEN,
  chooseGlyphRect,
  glyphText,
  stripsForRects,
  withoutPreviousHyphen,
  wordText,
} from "../../src/page-curl/page-draw";

describe("glyphText", () => {
  test("draws a visible soft hyphen as a hyphen", () => {
    expect(glyphText(SOFT_HYPHEN, 4.2, false)).toBe("-");
  });

  test("skips a zero-width soft hyphen", () => {
    expect(glyphText(SOFT_HYPHEN, 0, false)).toBeNull();
  });

  test("keeps ordinary glyphs and applies uppercase", () => {
    expect(glyphText("a", 7, false)).toBe("a");
    expect(glyphText("a", 7, true)).toBe("A");
  });
});

describe("wordText", () => {
  test("removes soft hyphens from a word drawn in one piece", () => {
    expect(wordText(`grand${SOFT_HYPHEN}es`, false)).toBe("grandes");
    expect(wordText(`grand${SOFT_HYPHEN}es`, true)).toBe("GRANDES");
  });
});

describe("chooseGlyphRect", () => {
  test("skips the hyphen slot reported before the first glyph of a wrapped line", () => {
    expect(chooseGlyphRect([{ width: 7 }, { width: 13 }], 13)).toBe(1);
  });

  test("keeps the glyph when the hyphen slot follows it", () => {
    expect(chooseGlyphRect([{ width: 20 }, { width: 7 }], 20)).toBe(0);
  });

  test("picks the letter-spaced glyph rect over the hyphen slot of the previous line", () => {
    expect(chooseGlyphRect([{ width: 9.5 }, { width: 18.3 }], 15.19 + 3.09)).toBe(1);
  });

  test("returns -1 without rects", () => {
    expect(chooseGlyphRect([], 10)).toBe(-1);
  });
});

describe("withoutPreviousHyphen", () => {
  test("drops a leading rect that sits where the previous glyph reported its hyphen", () => {
    const rects = [
      { left: 859, top: 215 },
      { left: 443, top: 241 },
    ];
    expect(withoutPreviousHyphen(rects, { left: 859.2, top: 215 })).toEqual([rects[1]]);
  });

  test("keeps every rect when nothing matches or only one rect exists", () => {
    const rects = [{ left: 10, top: 5 }];
    expect(withoutPreviousHyphen(rects, { left: 10, top: 5 })).toEqual(rects);
    expect(withoutPreviousHyphen(rects, undefined)).toEqual(rects);
  });
});

describe("stripsForRects", () => {
  test("gives a word wrapped over two lines one strip per line", () => {
    const rects = [
      { left: 300, bottom: 120, width: 80 },
      { left: 100, bottom: 160, width: 40 },
    ];
    const strips = stripsForRects(rects, { left: 100, top: 20 }, 20, 0.6);
    expect(strips).toEqual([
      { x: 200, y: 120 - 20 - 1.4 - 8.4 + 0, w: 80, h: 8.4, alpha: 0.6 },
      { x: 0, y: 160 - 20 - 1.4 - 8.4, w: 40, h: 8.4, alpha: 0.6 },
    ]);
  });
});
