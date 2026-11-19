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

export type FetchLike = (
  url: string,
  init?: RequestInit,
) => Promise<Pick<Response, "ok" | "status" | "json">>;

const LEMMA_CHUNK = 2000;

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
  fetcher: FetchLike = (url, init) => fetch(url, init),
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

  async function lemmaChunk(
    lang: string,
    words: readonly string[],
  ): Promise<Record<string, string>> {
    try {
      const response = await fetcher(`${baseUrl}/lemmas`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lang, words }),
      });
      if (!response.ok) {
        return {};
      }
      return ((await response.json()) as { lemmas: Record<string, string> }).lemmas;
    } catch {
      return {};
    }
  }

  async function lemmatize(
    lang: string,
    words: readonly string[],
  ): Promise<Record<string, string>> {
    if (!baseUrl) {
      return {};
    }
    const result: Record<string, string> = {};
    for (let start = 0; start < words.length; start += LEMMA_CHUNK) {
      Object.assign(result, await lemmaChunk(lang, words.slice(start, start + LEMMA_CHUNK)));
    }
    return result;
  }

  const translations = new Map<string, Promise<string | null>>();

  async function translateRequest(from: string, to: string, text: string): Promise<string | null> {
    if (!baseUrl) {
      return null;
    }
    try {
      const response = await fetcher(`${baseUrl}/translate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ from, to, texts: [text] }),
      });
      if (!response.ok) {
        return null;
      }
      const body = (await response.json()) as { translations?: string[] };
      return body.translations?.[0] ?? null;
    } catch {
      return null;
    }
  }

  function translate(from: string, to: string, text: string): Promise<string | null> {
    const key = `${from}:${to}:${text}`;
    const cached = translations.get(key);
    if (cached) {
      return cached;
    }
    const pending = translateRequest(from, to, text).then((result) => {
      if (result === null) {
        translations.delete(key);
      }
      return result;
    });
    translations.set(key, pending);
    return pending;
  }

  return {
    lemmatize,
    translate,
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
