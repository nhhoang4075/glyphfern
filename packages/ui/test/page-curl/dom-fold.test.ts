import { expect, test } from "bun:test";
import { clipHalf, polygonCss } from "../../src/page-curl/dom-fold";

const square: [number, number][] = [
  [0, 0],
  [100, 0],
  [100, 100],
  [0, 100],
];

test("clipping a square on x = 40 keeps the left part", () => {
  expect(clipHalf(square, 40, 50, -1, 0, 1)).toEqual([
    [0, 0],
    [40, 0],
    [40, 100],
    [0, 100],
  ]);
});

test("clipping with the opposite sign keeps the right part", () => {
  expect(clipHalf(square, 40, 50, -1, 0, -1)).toEqual([
    [40, 0],
    [100, 0],
    [100, 100],
    [40, 100],
  ]);
});

test("polygon css formatting", () => {
  expect(
    polygonCss([
      [1, 2],
      [3.14, 4],
    ]),
  ).toBe("polygon(1.0px 2.0px,3.1px 4.0px)");
});
