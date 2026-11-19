import { describe, expect, test } from "bun:test";
import { SLOT_LIMIT, SLOT_MIN, allocateSlot } from "../../src/app/book-slot";

describe("allocateSlot", () => {
  test("draws inside [1000, 2^30) from the injected random source", () => {
    expect(allocateSlot([], () => 0)).toBe(SLOT_MIN);
    expect(allocateSlot([], () => 0.999999999999)).toBe(SLOT_LIMIT - 1);
    expect(allocateSlot([], () => 0.5)).toBe(SLOT_MIN + Math.floor(0.5 * (SLOT_LIMIT - SLOT_MIN)));
  });

  test("re-draws while the slot is taken and never returns a taken one", () => {
    const draws = [0, 0, 0, 0.25];
    const slot = allocateSlot([SLOT_MIN], () => draws.shift() ?? 0.75);
    expect(slot).toBe(SLOT_MIN + Math.floor(0.25 * (SLOT_LIMIT - SLOT_MIN)));
    expect(draws).toEqual([]);
  });

  test("existing small slots stay valid and sentence ids stay exact integers", () => {
    const slot = allocateSlot([1, 2, 3], () => 0.999999999999);
    expect(Number.isSafeInteger(slot * 1_000_000 + 999_999)).toBe(true);
    expect(Math.floor((slot * 1_000_000 + 999_999) / 1_000_000)).toBe(slot);
  });
});
