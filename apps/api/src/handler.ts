import { type LemmaStore, resolveLemmas } from "./lexicon/lemmas";
import { type LexiconStore, lookupWord } from "./lexicon/lookup";

export interface HandlerDeps {
  store: LexiconStore & LemmaStore;
  allowedOrigin: string;
}

const SUPPORTED_LANGS = new Set(["es"]);
const MAX_WORD_LENGTH = 64;
const WORD_PATTERN = /^[\p{L}\p{N}'’-]+$/u;
const CACHE_SECONDS = 86400;
const MAX_LEMMA_WORDS = 5000;

function json(body: unknown, status: number, deps: HandlerDeps, cache = false): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": deps.allowedOrigin,
      ...(cache ? { "cache-control": `public, max-age=${CACHE_SECONDS}` } : {}),
    },
  });
}

export async function handle(request: Request, deps: HandlerDeps): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": deps.allowedOrigin,
        "access-control-allow-methods": "GET, POST",
        "access-control-allow-headers": "content-type",
      },
    });
  }
  if (request.method === "POST" && url.pathname === "/lemmas") {
    let body: { lang?: unknown; words?: unknown };
    try {
      body = (await request.json()) as { lang?: unknown; words?: unknown };
    } catch {
      return json({ error: "invalid_body" }, 400, deps);
    }
    const words = body.words;
    if (typeof body.lang !== "string" || !SUPPORTED_LANGS.has(body.lang)) {
      return json({ error: "unsupported_language" }, 400, deps);
    }
    const valid =
      Array.isArray(words) &&
      words.length <= MAX_LEMMA_WORDS &&
      words.every((w) => typeof w === "string" && w.length <= MAX_WORD_LENGTH);
    if (!valid) {
      return json({ error: "invalid_words" }, 400, deps);
    }
    return json(
      { lemmas: await resolveLemmas(deps.store, body.lang, words as string[]) },
      200,
      deps,
    );
  }
  if (request.method !== "GET") {
    return json({ error: "method_not_allowed" }, 405, deps);
  }
  if (url.pathname === "/health") {
    return json({ ok: true }, 200, deps);
  }
  if (url.pathname === "/lookup") {
    const lang = url.searchParams.get("lang") ?? "";
    const word = (url.searchParams.get("word") ?? "").trim();
    if (!SUPPORTED_LANGS.has(lang)) {
      return json({ error: "unsupported_language" }, 400, deps);
    }
    if (word.length === 0 || word.length > MAX_WORD_LENGTH || !WORD_PATTERN.test(word)) {
      return json({ error: "invalid_word" }, 400, deps);
    }
    const result = await lookupWord(deps.store, lang, word);
    return result ? json(result, 200, deps, true) : json({ error: "not_found" }, 404, deps, true);
  }
  return json({ error: "not_found" }, 404, deps);
}
