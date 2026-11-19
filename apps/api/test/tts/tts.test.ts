import { describe, expect, test } from "bun:test";
import { handle } from "../../src/handler";
import { createClientLimiter } from "../../src/translate/client-limiter";
import { BudgetExceededError, createDailyBudget } from "../../src/translate/translate-service";
import { createKokoroSynthesizer } from "../../src/tts/kokoro-synthesizer";
import { type SynthesisInput, type Synthesizer, SynthesizerError } from "../../src/tts/synthesizer";
import {
  type TtsCache,
  type TtsService,
  cacheKey,
  createTtsService,
} from "../../src/tts/tts-service";

const AUDIO = new Uint8Array([0x49, 0x44, 0x33, 1, 2, 3]);

function memoryCache(): TtsCache & { hashes: () => string[] } {
  const map = new Map<string, Uint8Array>();
  return {
    async get(hash) {
      return map.get(hash);
    },
    async put(hash, audio) {
      map.set(hash, audio);
    },
    hashes: () => [...map.keys()],
  };
}

function fakeSynthesizer(): Synthesizer & { calls: SynthesisInput[] } {
  const calls: SynthesisInput[] = [];
  return {
    calls,
    async synthesize(input) {
      calls.push(input);
      return AUDIO;
    },
  };
}

function failingSynthesizer(): Synthesizer {
  return {
    async synthesize() {
      throw new SynthesizerError("down");
    },
  };
}

const voices = { es: "ef_dora" };

describe("tts service", () => {
  test("a miss synthesizes with the configured voice and stores the audio", async () => {
    const synthesizer = fakeSynthesizer();
    const cache = memoryCache();
    const service = createTtsService(synthesizer, cache, createDailyBudget(1000), voices);
    const result = await service.synthesize({ lang: "es", text: "Hola", speed: 0.78 });
    expect(result.cached).toBe(false);
    expect(result.audio).toEqual(AUDIO);
    expect(synthesizer.calls).toEqual([{ voice: "ef_dora", text: "Hola", speed: 0.78 }]);
    expect(cache.hashes()).toEqual([await cacheKey("ef_dora", 0.78, "Hola")]);
  });

  test("a hit never calls the synthesizer or the budget", async () => {
    const synthesizer = fakeSynthesizer();
    const service = createTtsService(synthesizer, memoryCache(), createDailyBudget(4), voices);
    await service.synthesize({ lang: "es", text: "Hola", speed: 1 });
    const again = await service.synthesize({ lang: "es", text: "Hola", speed: 1 });
    expect(again.cached).toBe(true);
    expect(again.audio).toEqual(AUDIO);
    expect(synthesizer.calls).toHaveLength(1);
  });

  test("the cache key is the sha256 of voice, rounded speed and text", async () => {
    const expected = new Bun.CryptoHasher("sha256").update("ef_dora|0.78|Hola").digest("hex");
    expect(await cacheKey("ef_dora", 0.78, "Hola")).toBe(expected);
  });

  test("speeds that round to the same two decimals share one cache entry", async () => {
    const synthesizer = fakeSynthesizer();
    const cache = memoryCache();
    const service = createTtsService(synthesizer, cache, createDailyBudget(1000), voices);
    await service.synthesize({ lang: "es", text: "Hola", speed: 0.78 });
    const same = await service.synthesize({ lang: "es", text: "Hola", speed: Number("0.780") });
    const rounded = await service.synthesize({ lang: "es", text: "Hola", speed: 0.7800001 });
    expect(same.cached).toBe(true);
    expect(rounded.cached).toBe(true);
    expect(cache.hashes()).toHaveLength(1);
    expect(synthesizer.calls).toHaveLength(1);
    const other = await service.synthesize({ lang: "es", text: "Hola", speed: 0.88 });
    expect(other.cached).toBe(false);
    expect(cache.hashes()).toHaveLength(2);
  });

  test("a different voice or text gives a different key", async () => {
    const base = await cacheKey("ef_dora", 1, "Hola");
    expect(await cacheKey("em_alex", 1, "Hola")).not.toBe(base);
    expect(await cacheKey("ef_dora", 1, "Hola.")).not.toBe(base);
  });

  test("an used-up budget stops new audio but cached audio still answers", async () => {
    const synthesizer = fakeSynthesizer();
    const service = createTtsService(synthesizer, memoryCache(), createDailyBudget(4), voices);
    await service.synthesize({ lang: "es", text: "Hola", speed: 1 });
    await expect(
      service.synthesize({ lang: "es", text: "Adiós", speed: 1 }),
    ).rejects.toBeInstanceOf(BudgetExceededError);
    expect((await service.synthesize({ lang: "es", text: "Hola", speed: 1 })).cached).toBe(true);
    expect(synthesizer.calls).toHaveLength(1);
  });

  test("a failed synthesis stores nothing", async () => {
    const cache = memoryCache();
    const service = createTtsService(failingSynthesizer(), cache, createDailyBudget(1000), voices);
    await expect(service.synthesize({ lang: "es", text: "Hola", speed: 1 })).rejects.toBeInstanceOf(
      SynthesizerError,
    );
    expect(cache.hashes()).toEqual([]);
  });
});

describe("kokoro synthesizer", () => {
  const input = { voice: "ef_dora", text: "Hola", speed: 0.78 };

  test("it posts text, voice and speed and returns the audio bytes", async () => {
    let seen: { url: string; init: RequestInit | undefined } | undefined;
    const synthesizer = createKokoroSynthesizer({
      url: "http://tts.test:8788/",
      fetcher: (async (url: string, init?: RequestInit) => {
        seen = { url, init };
        return new Response(AUDIO, { status: 200 });
      }) as unknown as typeof fetch,
    });
    expect(await synthesizer.synthesize(input)).toEqual(AUDIO);
    expect(seen?.url).toBe("http://tts.test:8788/synthesize");
    expect(seen?.init?.method).toBe("POST");
    expect(JSON.parse(String(seen?.init?.body))).toEqual({
      text: "Hola",
      voice: "ef_dora",
      speed: 0.78,
    });
    expect(seen?.init?.signal).toBeInstanceOf(AbortSignal);
  });

  test("a waking service is retried until it answers", async () => {
    let calls = 0;
    let clock = 0;
    const synthesizer = createKokoroSynthesizer({
      url: "http://tts.test",
      now: () => clock,
      sleep: async (ms) => {
        clock += ms;
      },
      fetcher: (async () => {
        calls += 1;
        return calls < 3 ? new Response("", { status: 502 }) : new Response(AUDIO, { status: 200 });
      }) as unknown as typeof fetch,
    });
    expect(await synthesizer.synthesize(input)).toEqual(AUDIO);
    expect(calls).toBe(3);
  });

  test("a service that never wakes fails once the retry window is used", async () => {
    let clock = 0;
    let calls = 0;
    const synthesizer = createKokoroSynthesizer({
      url: "http://tts.test",
      retryWindowMs: 10_000,
      now: () => clock,
      sleep: async (ms) => {
        clock += ms;
      },
      fetcher: (async () => {
        calls += 1;
        return new Response("", { status: 503 });
      }) as unknown as typeof fetch,
    });
    await expect(synthesizer.synthesize(input)).rejects.toBeInstanceOf(SynthesizerError);
    expect(calls).toBeGreaterThan(2);
    expect(clock).toBeLessThanOrEqual(10_000);
  });

  test("a 400 or 500 reply is not retried", async () => {
    let calls = 0;
    const synthesizer = createKokoroSynthesizer({
      url: "http://tts.test",
      fetcher: (async () => {
        calls += 1;
        return new Response("{}", { status: 500 });
      }) as unknown as typeof fetch,
    });
    await expect(synthesizer.synthesize(input)).rejects.toBeInstanceOf(SynthesizerError);
    expect(calls).toBe(1);
  });

  test("a non-200 reply, an empty body and a network failure are typed errors", async () => {
    const make = (fetcher: unknown) =>
      createKokoroSynthesizer({
        url: "http://tts.test",
        fetcher: fetcher as typeof fetch,
        retryWindowMs: 0,
      });
    await expect(
      make(async () => new Response("{}", { status: 500 })).synthesize(input),
    ).rejects.toBeInstanceOf(SynthesizerError);
    await expect(
      make(async () => new Response("{}", { status: 400 })).synthesize(input),
    ).rejects.toBeInstanceOf(SynthesizerError);
    await expect(
      make(async () => new Response(new Uint8Array(0), { status: 200 })).synthesize(input),
    ).rejects.toBeInstanceOf(SynthesizerError);
    await expect(
      make(async () => {
        throw new TypeError("connection refused");
      }).synthesize(input),
    ).rejects.toBeInstanceOf(SynthesizerError);
  });

  test("a slow sidecar is cut off by the timeout", async () => {
    const synthesizer = createKokoroSynthesizer({
      url: "http://tts.test",
      timeoutMs: 20,
      retryWindowMs: 0,
      fetcher: ((_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        })) as unknown as typeof fetch,
    });
    await expect(synthesizer.synthesize(input)).rejects.toBeInstanceOf(SynthesizerError);
  });
});

describe("tts endpoint", () => {
  const store = {
    async findByWord() {
      return [];
    },
    async findForms() {
      return [];
    },
  };

  function depsWith(tts: TtsService | undefined, extra: object = {}) {
    return { store, allowedOrigin: "http://x", ...(tts ? { tts } : {}), ...extra };
  }

  function serviceOf(synthesizer: Synthesizer = fakeSynthesizer(), limit = 1000) {
    return createTtsService(synthesizer, memoryCache(), createDailyBudget(limit), voices);
  }

  function get(query: string, deps = depsWith(serviceOf()), client = "c") {
    return handle(new Request(`http://api.test/tts?${query}`), deps, client);
  }

  async function errorOf(response: Response): Promise<string> {
    return ((await response.json()) as { error: string }).error;
  }

  test("a valid request answers audio with the headers the web app needs", async () => {
    const response = await get("lang=es&text=Hola%2C%20mundo&speed=0.78");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("audio/mpeg");
    expect(response.headers.get("cache-control")).toBe("public, max-age=604800");
    expect(response.headers.get("access-control-allow-origin")).toBe("http://x");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(AUDIO);
  });

  test("the text is trimmed and a missing speed defaults to 1", async () => {
    const synthesizer = fakeSynthesizer();
    const deps = depsWith(serviceOf(synthesizer));
    await get("lang=es&text=%20%20Hola%20%20", deps);
    expect(synthesizer.calls).toEqual([{ voice: "ef_dora", text: "Hola", speed: 1 }]);
  });

  test("the same request twice calls the synthesizer once", async () => {
    const synthesizer = fakeSynthesizer();
    const deps = depsWith(serviceOf(synthesizer));
    await get("lang=es&text=Hola&speed=0.78", deps);
    const second = await get("lang=es&text=Hola&speed=0.780", deps);
    expect(second.status).toBe(200);
    expect(synthesizer.calls).toHaveLength(1);
  });

  test("an unsupported language, bad text and bad speed are refused", async () => {
    expect(await errorOf(await get("lang=xx&text=Hola"))).toBe("unsupported_language");
    expect((await get("text=Hola")).status).toBe(400);
    expect(await errorOf(await get("lang=es"))).toBe("invalid_text");
    expect(await errorOf(await get("lang=es&text=%20%20"))).toBe("invalid_text");
    expect(await errorOf(await get(`lang=es&text=${"a".repeat(501)}`))).toBe("invalid_text");
    expect((await get(`lang=es&text=${"a".repeat(500)}`)).status).toBe(200);
    expect(await errorOf(await get("lang=es&text=Hola&speed=0.49"))).toBe("invalid_speed");
    expect(await errorOf(await get("lang=es&text=Hola&speed=1.51"))).toBe("invalid_speed");
    expect(await errorOf(await get("lang=es&text=Hola&speed=fast"))).toBe("invalid_speed");
    expect(await errorOf(await get("lang=es&text=Hola&speed="))).toBe("invalid_speed");
    expect((await get("lang=es&text=Hola&speed=0.5")).status).toBe(200);
    expect((await get("lang=es&text=Hola&speed=1.5")).status).toBe(200);
  });

  test("without a configured sidecar the endpoint answers 503", async () => {
    const response = await get("lang=es&text=Hola", depsWith(undefined));
    expect(response.status).toBe(503);
    expect(await errorOf(response)).toBe("tts_not_configured");
  });

  test("an used-up budget answers 429 budget_exceeded", async () => {
    const response = await get("lang=es&text=Hola", depsWith(serviceOf(fakeSynthesizer(), 2)));
    expect(response.status).toBe(429);
    expect(await errorOf(response)).toBe("budget_exceeded");
  });

  test("a failing sidecar answers 502 tts_failed", async () => {
    const response = await get("lang=es&text=Hola", depsWith(serviceOf(failingSynthesizer())));
    expect(response.status).toBe(502);
    expect(await errorOf(response)).toBe("tts_failed");
  });

  test("one client cannot exceed its own request rate or daily characters", async () => {
    const limiter = createClientLimiter({ requestsPerMinute: 2, charactersPerDay: 10 });
    const deps = depsWith(serviceOf(), { limiter });
    expect((await get("lang=es&text=uno", deps, "a")).status).toBe(200);
    expect((await get("lang=es&text=dos", deps, "a")).status).toBe(200);
    const limited = await get("lang=es&text=tres", deps, "a");
    expect(limited.status).toBe(429);
    expect(await errorOf(limited)).toBe("rate_limited");
    expect((await get("lang=es&text=tres", deps, "b")).status).toBe(200);
    expect((await get("lang=es&text=cuatrocientos", deps, "b")).status).toBe(429);
  });

  test("a client over its limit is refused before the cache or the budget is touched", async () => {
    const synthesizer = fakeSynthesizer();
    const limiter = createClientLimiter({ requestsPerMinute: 1, charactersPerDay: 100 });
    const deps = depsWith(serviceOf(synthesizer), { limiter });
    await get("lang=es&text=uno", deps, "a");
    await get("lang=es&text=dos", deps, "a");
    expect(synthesizer.calls).toHaveLength(1);
  });
});
