import { describe, expect, test } from "bun:test";
import { seekPage, trackTicks } from "../../src/reader/track";

describe("trackTicks", () => {
  test("omits the tick on page 0 and keeps later chapters at start / (pages - 1)", () => {
    const ticks = trackTicks([0, 10, 30], 0, 41, 400);
    expect(ticks).toEqual([
      { chapter: 1, fraction: 0.25, done: false },
      { chapter: 2, fraction: 0.75, done: false },
    ]);
  });

  test("omits ticks closer than 22px to the marker", () => {
    const ticks = trackTicks([0, 10, 30], 10, 41, 400);
    expect(ticks.map((tick) => tick.chapter)).toEqual([2]);
    expect(ticks[0]?.done).toBe(false);
  });

  test("keeps a tick exactly 22px from the marker", () => {
    expect(trackTicks([0, 20], 21, 41, 880)).toEqual([{ chapter: 1, fraction: 0.5, done: true }]);
    expect(trackTicks([0, 20], 21, 41, 879)).toEqual([]);
  });

  test("marks passed chapters as done", () => {
    const ticks = trackTicks([0, 10, 30], 35, 41, 400);
    expect(ticks.map((tick) => tick.done)).toEqual([true, true]);
  });

  test("a single page has no ticks", () => {
    expect(trackTicks([0], 0, 1, 400)).toEqual([]);
  });
});

describe("seekPage", () => {
  test("maps x - 24 over width - 48 to a page", () => {
    expect(seekPage(24 + 100, 0, 248, 11)).toBe(5);
    expect(seekPage(24, 0, 248, 11)).toBe(0);
    expect(seekPage(224, 0, 248, 11)).toBe(10);
  });

  test("accounts for the track left offset", () => {
    expect(seekPage(300 + 24 + 50, 300, 148, 5)).toBe(2);
  });

  test("clamps taps inside the transparent side borders", () => {
    expect(seekPage(5, 0, 248, 11)).toBe(0);
    expect(seekPage(247, 0, 248, 11)).toBe(10);
  });

  test("rounds to the nearest page", () => {
    expect(seekPage(24 + 200 * 0.26, 0, 248, 11)).toBe(3);
    expect(seekPage(24 + 200 * 0.24, 0, 248, 11)).toBe(2);
  });

  test("returns page 0 for a single page or an empty track", () => {
    expect(seekPage(100, 0, 248, 1)).toBe(0);
    expect(seekPage(100, 0, 48, 10)).toBe(0);
  });
});
