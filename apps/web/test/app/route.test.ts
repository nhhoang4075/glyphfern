import { describe, expect, test } from "bun:test";
import { hashFromRoute, routeFromHash } from "../../src/app/route";

describe("hash routing", () => {
  test("the four views are routable and the default is read", () => {
    expect(routeFromHash("#library")).toBe("library");
    expect(routeFromHash("#read")).toBe("read");
    expect(routeFromHash("#words")).toBe("words");
    expect(routeFromHash("#review")).toBe("review");
    expect(routeFromHash("")).toBe("read");
    expect(routeFromHash("#nothing")).toBe("read");
  });

  test("a route round trips through its hash", () => {
    expect(routeFromHash(hashFromRoute("review"))).toBe("review");
  });
});
