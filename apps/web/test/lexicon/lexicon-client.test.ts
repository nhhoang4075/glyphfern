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
});
