import { expect, test } from "bun:test";
import * as core from "../src/index";

test("core package loads", () => {
  expect(core).toBeDefined();
});
