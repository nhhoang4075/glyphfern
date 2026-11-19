import { type AuthDeps, authRoute } from "./auth/auth-routes";
import { json } from "./http";
import { type LemmaStore, resolveLemmas } from "./lexicon/lemmas";
import { type LexiconStore, lookupWord } from "./lexicon/lookup";
import { bookRoute } from "./sync/book-routes";
import { syncRoute } from "./sync/sync-routes";
import type { SyncStore } from "./sync/sync-store";
import type { ClientLimiter } from "./translate/client-limiter";
import { BudgetExceededError, type TranslateService } from "./translate/translate-service";
import { TranslatorError } from "./translate/translator";
import { SynthesizerError } from "./tts/synthesizer";
import { type TtsService, roundSpeed } from "./tts/tts-service";

export interface HandlerDeps {
  store: LexiconStore & LemmaStore;
  allowedOrigin: string;
  translate?: TranslateService;
  tts?: TtsService;
  limiter?: ClientLimiter;
  auth?: AuthDeps;
  sync?: SyncStore;
}

const SUPPORTED_LANGS = new Set(["es"]);
const MAX_WORD_LENGTH = 64;
const WORD_PATTERN = /^[\p{L}\p{N}'’-]+$/u;
const MAX_LEMMA_WORDS = 5000;
const MAX_TRANSLATE_TEXTS = 20;
const MAX_TRANSLATE_CHARS = 500;
const TRANSLATE_PAIRS = new Set(["es:vi", "es:en", "en:vi"]);
const MAX_TTS_CHARS = 500;
const MIN_TTS_SPEED = 0.5;
const MAX_TTS_SPEED = 1.5;
const DEFAULT_TTS_SPEED = 1;
const TTS_CACHE_SECONDS = 604800;
export const MAX_BODY_BYTES = 512 * 1024;

function audio(body: Uint8Array, deps: HandlerDeps): Response {
  return new Response(new Uint8Array(body), {
    status: 200,
    headers: {
      "content-type": "audio/mpeg",
      "access-control-allow-origin": deps.allowedOrigin,
      "cache-control": `public, max-age=${TTS_CACHE_SECONDS}`,
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
        "access-control-allow-methods": "GET, POST, PUT, DELETE",
        "access-control-allow-headers": "content-type, authorization",
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
  if (url.pathname.startsWith("/auth/")) {
    return authRoute(request, url, deps);
  }
  if (url.pathname.startsWith("/sync/")) {
    return syncRoute(request, url, deps);
  }
  if (url.pathname.startsWith("/books/")) {
    return bookRoute(request, url, deps);
  }
  if (request.method !== "GET") {
    return json({ error: "method_not_allowed" }, 405, deps);
  }
  if (url.pathname === "/health") {
    return json({ ok: true }, 200, deps);
  }
  if (url.pathname === "/tts") {
    return ttsRoute(url, deps, client);
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

async function ttsRoute(url: URL, deps: HandlerDeps, client: string): Promise<Response> {
  if (!deps.tts) {
    return json({ error: "tts_not_configured" }, 503, deps);
  }
  const lang = url.searchParams.get("lang") ?? "";
  if (!SUPPORTED_LANGS.has(lang)) {
    return json({ error: "unsupported_language" }, 400, deps);
  }
  const text = (url.searchParams.get("text") ?? "").trim();
  if (text.length === 0 || text.length > MAX_TTS_CHARS) {
    return json({ error: "invalid_text" }, 400, deps);
  }
  const rawSpeed = url.searchParams.get("speed");
  const speed = rawSpeed === null ? DEFAULT_TTS_SPEED : Number(rawSpeed);
  if (!Number.isFinite(speed) || speed < MIN_TTS_SPEED || speed > MAX_TTS_SPEED) {
    return json({ error: "invalid_speed" }, 400, deps);
  }
  if (deps.limiter && !deps.limiter.allow(client, text.length)) {
    return json({ error: "rate_limited" }, 429, deps);
  }
  try {
    const result = await deps.tts.synthesize({ lang, text, speed: roundSpeed(speed) });
    return audio(result.audio, deps);
  } catch (error) {
    if (error instanceof BudgetExceededError) {
      return json({ error: "budget_exceeded" }, 429, deps);
    }
    if (error instanceof SynthesizerError) {
      return json({ error: "tts_failed" }, 502, deps);
    }
    throw error;
  }
}
