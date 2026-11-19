import { describe, expect, test } from "bun:test";
import { type LexiconStore, type StoredEntry, lookupWord } from "../../src/lexicon/lookup";
import { parseKaikkiLine } from "../../src/lexicon/parse-kaikki";
import { KAIKKI_LINES } from "./fixture";

function memoryStore(): LexiconStore {
  const rows = KAIKKI_LINES.flatMap((line) => {
    const row = parseKaikkiLine(line, "es");
    return row ? [row] : [];
  });
  return {
    async findByWord(_lang, word): Promise<StoredEntry[]> {
      return rows.filter((row) => row.word.toLowerCase() === word);
    },
  };
}

describe("looking up a word", () => {
  test("an inflected form resolves to its lemma entries", async () => {
    const result = await lookupWord(memoryStore(), "es", "miraba");
    expect(result?.lemma).toBe("mirar");
    expect(result?.entries).toEqual([
      { lemma: "mirar", pos: "verb", ipa: "/miˈɾaɾ/", glosses: ["to look at", "to watch"] },
    ]);
  });

  test("the lookup ignores the case of the surface", async () => {
    const result = await lookupWord(memoryStore(), "es", "Miraba");
    expect(result?.lemma).toBe("mirar");
    expect(result?.surface).toBe("Miraba");
  });

  test("a word that is both an entry and a form returns both readings", async () => {
    const result = await lookupWord(memoryStore(), "es", "como");
    expect(result?.lemma).toBe("como");
    expect(result?.entries.map((entry) => `${entry.lemma}:${entry.pos}`)).toEqual([
      "como:adv",
      "comer:verb",
    ]);
  });

  test("an unknown word has no result", async () => {
    expect(await lookupWord(memoryStore(), "es", "zzzz")).toBeUndefined();
  });
});
