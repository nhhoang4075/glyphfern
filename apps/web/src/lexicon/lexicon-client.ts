import type { DictEntry } from "@glyphfern/core";
import { type EntryFacts, buildNote } from "./entry-note";
import { posLabel } from "./pos-label";

export interface LookupEntry {
  lemma: string;
  pos: string;
  ipa: string | null;
  glosses: string[];
  facts?: EntryFacts | null;
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

export interface LemmaAnswer {
  lemmas: Record<string, string>;
  unknown: string[];
}

export interface GrammarRequest {
  lang: string;
  sentenceId: number;
  sentence: string;
  word: string;
  lemma: string;
}

const LEMMA_CHUNK = 2000;

const MAX_GLOSSES_SHOWN = 4;

export function toDictEntry(result: LookupResult): DictEntry | undefined {
  const entry =
    result.entries.find((candidate) => candidate.lemma === result.lemma) ?? result.entries[0];
  if (!entry) {
    return undefined;
  }
  const shown = entry.glosses.slice(0, MAX_GLOSSES_SHOWN);
  const note = buildNote(entry.facts, shown);
  return {
    pos: posLabel(entry.pos),
    pronunciation: entry.ipa ?? "",
    meaning: shown.join("; "),
    ...(note ? { note } : {}),
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

  async function lemmaChunk(lang: string, words: readonly string[]): Promise<LemmaAnswer | null> {
    try {
      const response = await fetcher(`${baseUrl}/lemmas`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lang, words }),
      });
      if (!response.ok) {
        return null;
      }
      const body = (await response.json()) as { lemmas?: unknown; unknown?: unknown } | null;
      const lemmas = body?.lemmas;
      if (typeof lemmas !== "object" || lemmas === null || Array.isArray(lemmas)) {
        return null;
      }
      const unknown = Array.isArray(body?.unknown)
        ? (body.unknown as unknown[]).filter((word): word is string => typeof word === "string")
        : [];
      return { lemmas: lemmas as Record<string, string>, unknown };
    } catch {
      return null;
    }
  }

  async function lemmatize(lang: string, words: readonly string[]): Promise<LemmaAnswer | null> {
    if (!baseUrl) {
      return null;
    }
    const result: LemmaAnswer = { lemmas: {}, unknown: [] };
    for (let start = 0; start < words.length; start += LEMMA_CHUNK) {
      const chunk = await lemmaChunk(lang, words.slice(start, start + LEMMA_CHUNK));
      if (chunk === null) {
        return null;
      }
      Object.assign(result.lemmas, chunk.lemmas);
      result.unknown.push(...chunk.unknown);
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

  const analyses = new Map<string, Promise<string[] | null>>();

  async function grammarRequest(request: GrammarRequest): Promise<string[] | null> {
    if (!baseUrl) {
      return null;
    }
    try {
      const response = await fetcher(`${baseUrl}/grammar`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lang: request.lang,
          sentence: request.sentence,
          word: request.word,
          lemma: request.lemma,
        }),
      });
      if (!response.ok) {
        return null;
      }
      const body = (await response.json()) as { notes?: unknown };
      const notes = Array.isArray(body.notes)
        ? body.notes.filter((note): note is string => typeof note === "string" && note.length > 0)
        : [];
      return notes.length > 0 ? notes : null;
    } catch {
      return null;
    }
  }

  function grammar(request: GrammarRequest): Promise<string[] | null> {
    const key = `${request.lang}:${request.sentenceId}:${request.lemma}:${request.sentence}`;
    const cached = analyses.get(key);
    if (cached) {
      return cached;
    }
    const pending = grammarRequest(request).then((result) => {
      if (result === null) {
        analyses.delete(key);
      }
      return result;
    });
    analyses.set(key, pending);
    return pending;
  }

  return {
    lemmatize,
    translate,
    grammar,
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
