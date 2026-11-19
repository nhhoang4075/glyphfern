import type { EntryFacts } from "./parse-kaikki";

export interface StoredEntry {
  word: string;
  pos: string;
  ipa: string | null;
  glosses: string[];
  lemma: string | null;
  facts: EntryFacts | null;
}

export interface LexiconStore {
  findByWord(lang: string, word: string): Promise<StoredEntry[]>;
}

export interface LookupEntry {
  lemma: string;
  pos: string;
  ipa: string | null;
  glosses: string[];
  facts: EntryFacts | null;
}

export interface LookupResult {
  surface: string;
  lemma: string;
  entries: LookupEntry[];
}

const MAX_LEMMAS = 3;
const MAX_ENTRIES = 6;

function toEntry(row: StoredEntry): LookupEntry {
  return {
    lemma: row.word.toLowerCase(),
    pos: row.pos,
    ipa: row.ipa,
    glosses: row.glosses,
    facts: row.facts,
  };
}

export async function lookupWord(
  store: LexiconStore,
  lang: string,
  surface: string,
): Promise<LookupResult | undefined> {
  const rows = await store.findByWord(lang, surface.toLowerCase());
  if (rows.length === 0) {
    return undefined;
  }
  const own = rows.filter((row) => row.lemma === null);
  const lemmas = [...new Set(rows.flatMap((row) => (row.lemma !== null ? [row.lemma] : [])))].slice(
    0,
    MAX_LEMMAS,
  );
  const entries = own.map(toEntry);
  for (const lemma of lemmas) {
    if (lemma === surface.toLowerCase()) {
      continue;
    }
    const lemmaRows = (await store.findByWord(lang, lemma)).filter((row) => row.lemma === null);
    entries.push(...lemmaRows.map(toEntry));
  }
  if (entries.length === 0) {
    return undefined;
  }
  entries.sort((a, b) => Number(a.pos === "name") - Number(b.pos === "name"));
  const primary = own.length > 0 ? surface.toLowerCase() : (lemmas[0] ?? surface.toLowerCase());
  return {
    surface,
    lemma: primary,
    entries: entries.slice(0, MAX_ENTRIES),
  };
}
