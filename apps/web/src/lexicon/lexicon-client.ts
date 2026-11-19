import type { DictEntry } from "@glyphfern/core";
import { posLabel } from "./pos-label";

export interface LookupEntry {
  lemma: string;
  pos: string;
  ipa: string | null;
  glosses: string[];
}

export interface LookupResult {
  surface: string;
  lemma: string;
  entries: LookupEntry[];
}

export type FetchLike = (url: string) => Promise<Pick<Response, "ok" | "status" | "json">>;

const MAX_GLOSSES_SHOWN = 4;

export function toDictEntry(result: LookupResult): DictEntry | undefined {
  const entry =
    result.entries.find((candidate) => candidate.lemma === result.lemma) ?? result.entries[0];
  if (!entry) {
    return undefined;
  }
  return {
    pos: posLabel(entry.pos),
    pronunciation: entry.ipa ?? "",
    meaning: entry.glosses.slice(0, MAX_GLOSSES_SHOWN).join("; "),
  };
}

export function createLexiconClient(
  baseUrl: string | undefined,
  fetcher: FetchLike = (url) => fetch(url),
) {
  const cache = new Map<string, Promise<LookupResult | null>>();

  async function request(lang: string, word: string): Promise<LookupResult | null> {
    if (!baseUrl) {
      return null;
    }
    const url = `${baseUrl}/lookup?lang=${encodeURIComponent(lang)}&word=${encodeURIComponent(word)}`;
    try {
      const response = await fetcher(url);
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        throw new Error(`lookup failed with ${response.status}`);
      }
      return (await response.json()) as LookupResult;
    } catch {
      return null;
    }
  }

  return {
    lookup(lang: string, word: string): Promise<LookupResult | null> {
      const key = `${lang}:${word.toLowerCase()}`;
      const cached = cache.get(key);
      if (cached) {
        return cached;
      }
      const pending = request(lang, word).then((result) => {
        if (result === null) {
          cache.delete(key);
        }
        return result;
      });
      cache.set(key, pending);
      return pending;
    },
  };
}

export const lexicon = createLexiconClient(import.meta.env.VITE_API_URL);
