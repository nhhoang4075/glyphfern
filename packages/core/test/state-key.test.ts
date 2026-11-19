import { expect, test } from "bun:test";
import { stateKey } from "../src/state-key";

test("state key joins language and lemma with a colon", () => {
  expect(stateKey("es", "haber")).toBe("es:haber");
  expect(stateKey("ko", "먹다")).toBe("ko:먹다");
});

test("the same lemma in two languages produces different keys", () => {
  expect(stateKey("es", "mar")).not.toBe(stateKey("ko", "mar"));
});
