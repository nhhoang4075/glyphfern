import { describe, expect, test } from "bun:test";
import { SOFT_HYPHEN, glyphText, wordText } from "../../src/page-curl/page-draw";

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
