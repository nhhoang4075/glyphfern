import { describe, expect, test } from "bun:test";
import { handle } from "../src/handler";
import type { LexiconStore } from "../src/lexicon/lookup";

const store: LexiconStore = {
  async findByWord(_lang, word) {
    return word === "lobo"
      ? [{ word: "lobo", pos: "noun", ipa: "/ˈlo.βo/", glosses: ["wolf"], lemma: null }]
      : [];
  },
};
const deps = { store, allowedOrigin: "http://localhost:5183" };

function get(path: string, method = "GET") {
  return handle(new Request(`http://api.test${path}`, { method }), deps);
}

describe("api handler", () => {
  test("health answers ok", async () => {
    expect(await (await get("/health")).json()).toEqual({ ok: true });
  });

  test("a known word returns its entries with caching and CORS headers", async () => {
    const response = await get("/lookup?lang=es&word=lobo");
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:5183");
    expect(response.headers.get("cache-control")).toContain("max-age=86400");
    expect(((await response.json()) as { lemma: string }).lemma).toBe("lobo");
  });

  test("unknown words, bad input and wrong methods are rejected", async () => {
    expect((await get("/lookup?lang=es&word=zzz")).status).toBe(404);
    expect((await get("/lookup?lang=xx&word=lobo")).status).toBe(400);
    expect((await get("/lookup?lang=es&word=a%20b")).status).toBe(400);
    expect((await get("/lookup?lang=es&word=")).status).toBe(400);
    expect((await get("/lookup?lang=es&word=lobo", "POST")).status).toBe(405);
    expect((await get("/nope")).status).toBe(404);
  });
});
