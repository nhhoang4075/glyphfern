import { describe, expect, test } from "bun:test";
import {
  type LookupResult,
  createLexiconClient,
  toDictEntry,
} from "../../src/lexicon/lexicon-client";
import { posLabel } from "../../src/lexicon/pos-label";

const MIRAR: LookupResult = {
  surface: "miraba",
  lemma: "mirar",
  entries: [{ lemma: "mirar", pos: "verb", ipa: "/miˈɾaɾ/", glosses: ["to look at", "to watch"] }],
};

describe("lexicon entries", () => {
  test("a lookup result becomes a dictionary entry with a Vietnamese part of speech", () => {
    expect(toDictEntry(MIRAR)).toEqual({
      pos: "động từ",
      pronunciation: "/miˈɾaɾ/",
      meaning: "to look at; to watch",
    });
  });

  test("an unknown part of speech is shown as is", () => {
    expect(posLabel("weird")).toBe("weird");
  });
});

describe("lexicon client", () => {
  test("without an API address nothing is requested", async () => {
    const client = createLexiconClient(undefined, () => {
      throw new Error("must not fetch");
    });
    expect(await client.lookup("es", "lobo")).toBeNull();
  });

  test("a result is fetched once and then served from memory", async () => {
    let calls = 0;
    const client = createLexiconClient("http://api", async (url) => {
      calls += 1;
      expect(url).toBe("http://api/lookup?lang=es&word=miraba");
      return { ok: true, status: 200, json: async () => MIRAR };
    });
    expect(await client.lookup("es", "miraba")).toEqual(MIRAR);
    expect(await client.lookup("es", "Miraba")).toEqual(MIRAR);
    expect(calls).toBe(1);
  });

  test("a missing word and a network failure give null and are retried later", async () => {
    let calls = 0;
    const client = createLexiconClient("http://api", async () => {
      calls += 1;
      if (calls === 1) {
        return { ok: false, status: 404, json: async () => ({}) };
      }
      throw new Error("offline");
    });
    expect(await client.lookup("es", "zzz")).toBeNull();
    expect(await client.lookup("es", "zzz")).toBeNull();
    expect(calls).toBe(2);
  });

  test("lemmas are requested in chunks and merged when every chunk succeeds", async () => {
    const bodies: string[][] = [];
    const client = createLexiconClient("http://api", async (_url, init) => {
      const words = (JSON.parse(String(init?.body)) as { words: string[] }).words;
      bodies.push(words);
      return { ok: true, status: 200, json: async () => ({ lemmas: { [words[0] ?? ""]: "x" } }) };
    });
    const words = Array.from({ length: 4500 }, (_, i) => `w${i}`);
    const answer = await client.lemmatize("es", words);
    expect(bodies.map((b) => b.length)).toEqual([2000, 2000, 500]);
    expect(Object.keys(answer?.lemmas ?? {})).toEqual(["w0", "w2000", "w4000"]);
  });

  test("the unknown lists of every chunk are merged", async () => {
    const client = createLexiconClient("http://api", async (_url, init) => {
      const words = (JSON.parse(String(init?.body)) as { words: string[] }).words;
      return {
        ok: true,
        status: 200,
        json: async () => ({ lemmas: {}, unknown: [words[0] ?? ""] }),
      };
    });
    const words = Array.from({ length: 2500 }, (_, i) => `w${i}`);
    expect((await client.lemmatize("es", words))?.unknown).toEqual(["w0", "w2000"]);
  });

  test("a body without an unknown list gives an empty one", async () => {
    const client = createLexiconClient("http://api", async () => ({
      ok: true,
      status: 200,
      json: async () => ({ lemmas: { a: "b" } }),
    }));
    expect(await client.lemmatize("es", ["a"])).toEqual({ lemmas: { a: "b" }, unknown: [] });
  });

  test("lemmatize returns null without a base URL", async () => {
    const client = createLexiconClient(undefined, async () => {
      throw new Error("must not be called");
    });
    expect(await client.lemmatize("es", ["miraba"])).toBeNull();
  });

  test("lemmatize returns null when a chunk throws", async () => {
    let calls = 0;
    const client = createLexiconClient("http://api", async () => {
      calls += 1;
      if (calls === 2) {
        throw new Error("offline");
      }
      return { ok: true, status: 200, json: async () => ({ lemmas: { a: "b" } }) };
    });
    const words = Array.from({ length: 4500 }, (_, i) => `w${i}`);
    expect(await client.lemmatize("es", words)).toBeNull();
  });

  test("lemmatize returns null when a chunk answers with an error status", async () => {
    const client = createLexiconClient("http://api", async () => ({
      ok: false,
      status: 503,
      json: async () => ({}),
    }));
    expect(await client.lemmatize("es", ["miraba"])).toBeNull();
  });

  test("lemmatize returns null when the body is malformed", async () => {
    for (const body of [{}, { lemmas: null }, { lemmas: ["x"] }, null]) {
      const client = createLexiconClient("http://api", async () => ({
        ok: true,
        status: 200,
        json: async () => body,
      }));
      expect(await client.lemmatize("es", ["miraba"])).toBeNull();
    }
  });
});

describe("machine translation", () => {
  test("a text is translated once and a failure is not cached", async () => {
    let calls = 0;
    const client = createLexiconClient("http://api", async (_url, init) => {
      calls += 1;
      const body = JSON.parse(String(init?.body)) as { from: string; to: string; texts: string[] };
      if (calls === 1) {
        return { ok: false, status: 502, json: async () => ({}) };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ translations: [`${body.to}:${body.texts[0]}`] }),
      };
    });
    expect(await client.translate("es", "vi", "lobo")).toBeNull();
    expect(await client.translate("es", "vi", "lobo")).toBe("vi:lobo");
    expect(await client.translate("es", "vi", "lobo")).toBe("vi:lobo");
    expect(calls).toBe(2);
  });
});
