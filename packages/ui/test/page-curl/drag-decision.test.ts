import { expect, test } from "bun:test";
import { decideRelease, exceedsTap } from "../../src/page-curl/drag-decision";

test("six pixels is still a tap, beyond is a drag", () => {
  expect(exceedsTap(3, 4)).toBe(false);
  expect(exceedsTap(6, 0)).toBe(false);
  expect(exceedsTap(6, 1)).toBe(true);
});

test("release without movement is a tap", () => {
  expect(
    decideRelease({ moved: false, cancelled: false, distanceFromCorner: 2, bookWidth: 800 }),
  ).toBe("tap");
});

test("complete beyond 30% of the book width, cancel otherwise", () => {
  const base = { moved: true, cancelled: false, bookWidth: 800 };
  expect(decideRelease({ ...base, distanceFromCorner: 241 })).toBe("complete");
  expect(decideRelease({ ...base, distanceFromCorner: 240 })).toBe("cancel");
  expect(decideRelease({ ...base, distanceFromCorner: 100 })).toBe("cancel");
});

test("a cancelled gesture never completes or taps", () => {
  expect(
    decideRelease({ moved: true, cancelled: true, distanceFromCorner: 700, bookWidth: 800 }),
  ).toBe("cancel");
  expect(
    decideRelease({ moved: false, cancelled: true, distanceFromCorner: 0, bookWidth: 800 }),
  ).toBe("cancel");
});
