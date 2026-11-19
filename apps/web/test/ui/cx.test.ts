import { describe, expect, test } from "bun:test";
import { cx } from "../../src/ui/cx";

describe("cx", () => {
  test("joins truthy parts in order", () => {
    expect(cx("st", "nw", true && "on")).toBe("st nw on");
  });

  test("drops false, null, undefined and empty parts", () => {
    expect(cx("a", false, null, undefined, "", "b")).toBe("a b");
  });

  test("returns an empty string when nothing remains", () => {
    expect(cx(false, undefined)).toBe("");
  });
});
