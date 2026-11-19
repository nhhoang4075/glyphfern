import { describe, expect, test } from "bun:test";
import { SOFT_HYPHEN, chooseGlyphRect, glyphText, wordText } from "../../src/page-curl/page-draw";

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

  test("returns -1 without rects", () => {
    expect(chooseGlyphRect([], 10)).toBe(-1);
  });
});
