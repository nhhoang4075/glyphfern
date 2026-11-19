import { expect, test } from "bun:test";
import { easeOut, yEase } from "./easing";
import { idlePoint, sweepAt, sweepEnd, sweepPoint } from "./sweepPath";

test("end points", () => {
  const right = sweepEnd("r", 800, 1000);
  expect(right[0]).toBeCloseTo(-1040, 9);
  expect(right[1]).toBe(1000);
  const left = sweepEnd("l", 800, 1000);
  expect(left[0]).toBeCloseTo(1840, 9);
  expect(left[1]).toBe(1000);
});

test("easing values", () => {
  expect(easeOut(0)).toBe(0);
  expect(easeOut(1)).toBe(1);
  expect(easeOut(0.5)).toBeCloseTo(0.7320566, 6);
  expect(yEase(0.5)).toBeCloseTo(0.7823624, 6);
});

test("sweep point at start, middle and end", () => {
  const from: [number, number] = [700, 900];
  const end: [number, number] = [-1040, 1000];
  expect(sweepPoint(from, end, 0, 1000)).toEqual(from);
  const [x, y] = sweepPoint(from, end, 0.5, 1000);
  expect(x).toBeCloseTo(-170, 6);
  expect(y).toBeCloseTo(928.2362, 3);
  const [ex, ey] = sweepPoint(from, end, 1, 1000);
  expect(ex).toBeCloseTo(-1040, 9);
  expect(ey).toBeCloseTo(1000, 9);
});

test("sweepAt applies easeOut to the linear progress", () => {
  const from: [number, number] = [700, 900];
  const end: [number, number] = [-1040, 1000];
  const [x] = sweepAt(from, end, 0.5, 1000);
  expect(x).toBeCloseTo(700 - 1740 * 0.7320566, 3);
});

test("idle points", () => {
  expect(idlePoint("r", 26, 800, 1000)).toEqual([774, 974]);
  expect(idlePoint("l", 26, 800, 1000)).toEqual([26, 974]);
});
