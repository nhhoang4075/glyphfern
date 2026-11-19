import { expect, test } from "bun:test";
import { cornerPoint, foldParams } from "./foldParams";

test("corner points", () => {
  expect(cornerPoint("r", 800, 1000)).toEqual([800, 1000]);
  expect(cornerPoint("l", 800, 1000)).toEqual([0, 1000]);
});

test("horizontal drag from the right corner", () => {
  const p = foldParams("r", 700, 1000, 800, 1000);
  expect(p.ux).toBeCloseTo(-1, 9);
  expect(p.uy).toBeCloseTo(0, 9);
  expect(p.L).toBeCloseTo(100, 9);
  expect(p.a).toBeCloseTo(50.942478, 5);
  expect(p.R).toBe(0.6);
});

test("vertical component is halved", () => {
  const p = foldParams("r", 400, 800, 800, 1000);
  expect(p.ux).toBeCloseTo(-0.970143, 5);
  expect(p.uy).toBeCloseTo(-0.242536, 5);
  expect(p.L).toBeCloseTo(436.5646, 3);
});

test("no movement gives zero arc and a horizontal direction", () => {
  const right = foldParams("r", 800, 1000, 800, 1000);
  expect(right.ux).toBe(-1);
  expect(right.a).toBe(0);
  const left = foldParams("l", 0.2, 1000, 800, 1000);
  expect(left.ux).toBe(1);
  expect(left.L).toBe(0);
});

test("dragging past the corner on the wrong side keeps a unit direction", () => {
  const p = foldParams("r", 900, 1000, 800, 1000);
  expect(p.ux).toBeCloseTo(1, 9);
  expect(p.L).toBeCloseTo(100, 9);
});
