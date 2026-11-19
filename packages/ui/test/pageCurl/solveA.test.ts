import { expect, test } from "bun:test";
import { solveA } from "../../src/pageCurl/solveA";

test("non-positive drag length gives zero arc", () => {
  expect(solveA(0)).toBe(0);
  expect(solveA(-5)).toBe(0);
});

test("long drag uses 2a - pi*R, so a = (L + pi*R) / 2", () => {
  expect(solveA(100, 0.6)).toBeCloseTo(50.942478, 5);
  expect(solveA(436.5646, 0.6)).toBeCloseTo((436.5646 + Math.PI * 0.6) / 2, 5);
});

test("at L = pi*R both branches meet at a = pi*R", () => {
  expect(solveA(Math.PI * 0.6, 0.6)).toBeCloseTo(1.884956, 5);
});

test("short drag stays below pi*R and is monotonic", () => {
  const small = solveA(0.5, 0.6);
  const larger = solveA(1.5, 0.6);
  expect(small).toBeGreaterThan(0);
  expect(small).toBeLessThan(larger);
  expect(larger).toBeLessThan(Math.PI * 0.6);
  expect(small - 0.6 * Math.sin(small / 0.6)).toBeCloseTo(0.5, 6);
});
