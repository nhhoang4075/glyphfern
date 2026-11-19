import { type LemmaStore, resolveLemmas } from "./lexicon/lemmas";
import { type LexiconStore, lookupWord } from "./lexicon/lookup";
import type { ClientLimiter } from "./translate/client-limiter";
import { BudgetExceededError, type TranslateService } from "./translate/translate-service";
import { TranslatorError } from "./translate/translator";

export interface HandlerDeps {
  store: LexiconStore & LemmaStore;
  allowedOrigin: string;
  translate?: TranslateService;
  limiter?: ClientLimiter;
}

const SUPPORTED_LANGS = new Set(["es"]);
const MAX_WORD_LENGTH = 64;
const WORD_PATTERN = /^[\p{L}\p{N}'’-]+$/u;
const CACHE_SECONDS = 86400;
const MAX_LEMMA_WORDS = 5000;
const MAX_TRANSLATE_TEXTS = 20;
const MAX_TRANSLATE_CHARS = 500;
const TRANSLATE_PAIRS = new Set(["es:vi", "es:en", "en:vi"]);
export const MAX_BODY_BYTES = 512 * 1024;

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

export async function handle(
  request: Request,
  deps: HandlerDeps,
  client = "unknown",
): Promise<Response> {
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
  if (request.method === "POST" && url.pathname === "/translate") {
    return translateRoute(request, deps, client);
  }
  if (request.method === "POST" && url.pathname === "/lemmas") {
    const declared = Number(request.headers.get("content-length") ?? Number.NaN);
    if (!Number.isFinite(declared) || declared > MAX_BODY_BYTES) {
      return json({ error: "payload_too_large" }, 413, deps);
    }
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

async function translateRoute(
  request: Request,
  deps: HandlerDeps,
  client: string,
): Promise<Response> {
  if (!deps.translate) {
    return json({ error: "translator_not_configured" }, 503, deps);
  }
  const declared = Number(request.headers.get("content-length") ?? Number.NaN);
  if (!Number.isFinite(declared) || declared > MAX_BODY_BYTES) {
    return json({ error: "payload_too_large" }, 413, deps);
  }
  let body: { from?: unknown; to?: unknown; texts?: unknown };
  try {
    body = (await request.json()) as { from?: unknown; to?: unknown; texts?: unknown };
  } catch {
    return json({ error: "invalid_body" }, 400, deps);
  }
  const texts = body.texts;
  const pair = `${String(body.from)}:${String(body.to)}`;
  const valid =
    TRANSLATE_PAIRS.has(pair) &&
    Array.isArray(texts) &&
    texts.length > 0 &&
    texts.length <= MAX_TRANSLATE_TEXTS &&
    texts.every(
      (text) =>
        typeof text === "string" && text.trim().length > 0 && text.length <= MAX_TRANSLATE_CHARS,
    );
  if (!valid) {
    return json({ error: "invalid_request" }, 400, deps);
  }
  const characters = (texts as string[]).reduce((sum, text) => sum + text.length, 0);
  if (deps.limiter && !deps.limiter.allow(client, characters)) {
    return json({ error: "rate_limited" }, 429, deps);
  }
  try {
    const translations = await deps.translate.translateAll(
      texts as string[],
      String(body.from),
      String(body.to),
    );
    return json({ translations }, 200, deps);
  } catch (error) {
    if (error instanceof BudgetExceededError) {
      return json({ error: "budget_exceeded" }, 429, deps);
    }
    if (error instanceof TranslatorError) {
      return json({ error: "translator_failed" }, 502, deps);
    }
    throw error;
  }
}
