export interface FormRow {
  word: string;
  lemma: string | null;
}

export interface LemmaStore {
  findForms(lang: string, words: readonly string[]): Promise<FormRow[]>;
}

export interface LemmaResolution {
  lemmas: Record<string, string>;
  unknown: string[];
}

export async function resolveLemmas(
  store: LemmaStore,
  lang: string,
  words: readonly string[],
): Promise<LemmaResolution> {
  const unique = [...new Set(words.map((word) => word.toLowerCase()))];
  const rows = await store.findForms(lang, unique);
  const own = new Set<string>();
  const known = new Set<string>();
  const pointers = new Map<string, string>();
  for (const row of rows) {
    const key = row.word.toLowerCase();
    known.add(key);
    if (row.lemma === null) {
      own.add(key);
    } else if (!pointers.has(key)) {
      pointers.set(key, row.lemma);
    }
  }
  const entries: [string, string][] = [];
  for (const [word, lemma] of pointers) {
    if (!own.has(word) && lemma !== word) {
      entries.push([word, lemma]);
    }
  }
  return {
    lemmas: Object.fromEntries(entries),
    unknown: unique.filter((word) => !known.has(word)),
  };
}
