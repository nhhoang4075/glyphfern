import { expect, test } from "bun:test";
import { stateKey } from "../src/state-key";

test("state key joins language and lemma with a colon", () => {
  expect(stateKey("es", "haber")).toBe("es:haber");
  expect(stateKey("es", "mar")).toBe("es:mar");
});
