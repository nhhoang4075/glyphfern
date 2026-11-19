import { describe, expect, test } from "bun:test";
import { handle } from "../../src/handler";
import { createClientLimiter, normalizeClient } from "../../src/translate/client-limiter";
import { createCloudflareTranslator } from "../../src/translate/cloudflare-translator";
import {
  BudgetExceededError,
  type TranslationCache,
  createDailyBudget,
  createTranslateService,
  hashText,
} from "../../src/translate/translate-service";
import { type Translator, TranslatorError } from "../../src/translate/translator";

function memoryCache(): TranslationCache & { size: () => number } {
  const map = new Map<string, string>();
  return {
    async get(s, t, h) {
      return map.get(`${s}:${t}:${h}`);
    },
    async put(s, t, h, _text, translated) {
      map.set(`${s}:${t}:${h}`, translated);
    },
    size: () => map.size,
  };
}

function fakeTranslator(): Translator & { calls: string[] } {
  const calls: string[] = [];
  return {
    name: "fake",
    calls,
    async translate(text) {
      calls.push(text);
      return `vi:${text}`;
    },
  };
}

describe("translate service", () => {
  test("a text is translated once and then served from the cache", async () => {
    const translator = fakeTranslator();
    const service = createTranslateService(translator, memoryCache(), createDailyBudget(1000));
    expect(await service.translateAll(["lobo", "casa"], "es", "vi")).toEqual([
      "vi:lobo",
      "vi:casa",
    ]);
    expect(await service.translateAll(["lobo"], "es", "vi")).toEqual(["vi:lobo"]);
    expect(translator.calls).toEqual(["lobo", "casa"]);
  });

  test("the daily budget stops new translations but cached ones still answer", async () => {
    const service = createTranslateService(fakeTranslator(), memoryCache(), createDailyBudget(6));
    await service.translateAll(["lobo"], "es", "vi");
    await expect(service.translateAll(["casa grande"], "es", "vi")).rejects.toBeInstanceOf(
      BudgetExceededError,
    );
    expect(await service.translateAll(["lobo"], "es", "vi")).toEqual(["vi:lobo"]);
  });

  test("the budget resets on a new day", () => {
    let now = new Date("2026-11-19T10:00:00Z");
    const budget = createDailyBudget(5, () => now);
    expect(budget.tryConsume(5)).toBe(true);
    expect(budget.tryConsume(1)).toBe(false);
    now = new Date("2026-11-20T00:00:01Z");
    expect(budget.tryConsume(5)).toBe(true);
  });

  test("hashes are stable", async () => {
    expect(await hashText("a")).toBe(await hashText("a"));
    expect(await hashText("a")).not.toBe(await hashText("b"));
  });
});

describe("cloudflare translator", () => {
  const options = { accountId: "acc", apiToken: "tok" };

  test("it posts the text with codes and the bearer token and reads the translation", async () => {
    let seen: { url: string; init: RequestInit | undefined } | undefined;
    const translator = createCloudflareTranslator({
      ...options,
      fetcher: (async (url: string, init?: RequestInit) => {
        seen = { url, init };
        return Response.json({ success: true, result: { translated_text: "con sói" } });
      }) as unknown as typeof fetch,
    });
    expect(await translator.translate("el lobo", "es", "vi")).toBe("con sói");
    expect(seen?.url).toBe(
      "https://api.cloudflare.com/client/v4/accounts/acc/ai/run/@cf/meta/m2m100-1.2b",
    );
    expect((seen?.init?.headers as Record<string, string>).authorization).toBe("Bearer tok");
    expect(JSON.parse(String(seen?.init?.body))).toEqual({
      text: "el lobo",
      source_lang: "es",
      target_lang: "vi",
    });
  });

  test("an error status or an empty reply is a TranslatorError", async () => {
    const failing = createCloudflareTranslator({
      ...options,
      fetcher: (async () => new Response("no", { status: 500 })) as unknown as typeof fetch,
    });
    await expect(failing.translate("a", "es", "vi")).rejects.toBeInstanceOf(TranslatorError);
    const empty = createCloudflareTranslator({
      ...options,
      fetcher: (async () =>
        Response.json({ success: true, result: {} })) as unknown as typeof fetch,
    });
    await expect(empty.translate("a", "es", "vi")).rejects.toBeInstanceOf(TranslatorError);
  });
});

describe("translate endpoint", () => {
  const store = {
    async findByWord() {
      return [];
    },
    async findForms() {
      return [];
    },
  };
  const service = createTranslateService(fakeTranslator(), memoryCache(), createDailyBudget(1000));
  const deps = { store, allowedOrigin: "http://x", translate: service };

  function post(body: unknown, withDeps = deps) {
    const text = JSON.stringify(body);
    return handle(
      new Request("http://api.test/translate", {
        method: "POST",
        headers: { "content-length": String(text.length) },
        body: text,
      }),
      withDeps,
    );
  }

  test("valid texts are translated", async () => {
    const response = await post({ from: "es", to: "vi", texts: ["lobo"] });
    expect(await response.json()).toEqual({ translations: ["vi:lobo"] });
  });

  test("bad language pairs, empty or long texts and too many texts are refused", async () => {
    expect((await post({ from: "es", to: "xx", texts: ["a"] })).status).toBe(400);
    expect((await post({ from: "es", to: "vi", texts: [] })).status).toBe(400);
    expect((await post({ from: "es", to: "vi", texts: ["  "] })).status).toBe(400);
    expect((await post({ from: "es", to: "vi", texts: ["a".repeat(501)] })).status).toBe(400);
    expect((await post({ from: "es", to: "vi", texts: Array(21).fill("a") })).status).toBe(400);
  });

  test("without a translator the endpoint answers 503, and an used-up budget answers 429", async () => {
    const { translate: _unused, ...bare } = deps;
    expect((await post({ from: "es", to: "vi", texts: ["a"] }, bare)).status).toBe(503);
    const tight = createTranslateService(fakeTranslator(), memoryCache(), createDailyBudget(1));
    const response = await post(
      { from: "es", to: "vi", texts: ["largo"] },
      { ...deps, translate: tight },
    );
    expect(response.status).toBe(429);
  });

  test("one client cannot exceed its own request rate or daily characters", async () => {
    const limiter = createClientLimiter({ requestsPerMinute: 2, charactersPerDay: 10 });
    const limited = { ...deps, limiter };
    const send = (client: string, text: string) =>
      handle(
        new Request("http://api.test/translate", {
          method: "POST",
          headers: { "content-length": "60" },
          body: JSON.stringify({ from: "es", to: "vi", texts: [text] }),
        }),
        limited,
        client,
      );
    expect((await send("a", "uno")).status).toBe(200);
    expect((await send("a", "dos")).status).toBe(200);
    expect((await send("a", "tres")).status).toBe(429);
    expect((await send("b", "tres")).status).toBe(200);
    expect((await send("b", "cuatrocientos")).status).toBe(429);
  });
});

describe("client limiter", () => {
  test("the window resets each minute and the character count each day", () => {
    let now = new Date("2026-11-19T10:00:10Z");
    const limiter = createClientLimiter({ requestsPerMinute: 1, charactersPerDay: 5 }, () => now);
    expect(limiter.allow("a", 3)).toBe(true);
    expect(limiter.allow("a", 1)).toBe(false);
    now = new Date("2026-11-19T10:01:10Z");
    expect(limiter.allow("a", 3)).toBe(false);
    now = new Date("2026-11-20T10:00:10Z");
    expect(limiter.allow("a", 3)).toBe(true);
  });

  test("a full table sends new clients to a shared overflow bucket and keeps live ones", () => {
    const limiter = createClientLimiter({
      requestsPerMinute: 1,
      charactersPerDay: 5,
      maxClients: 2,
    });
    expect(limiter.allow("a", 1)).toBe(true);
    expect(limiter.allow("b", 1)).toBe(true);
    expect(limiter.allow("c", 1)).toBe(true);
    expect(limiter.allow("d", 1)).toBe(true);
    expect(limiter.allow("e", 1)).toBe(true);
    expect(limiter.allow("f", 1)).toBe(true);
    expect(limiter.allow("g", 1)).toBe(false);
    expect(limiter.allow("a", 1)).toBe(false);
  });

  test("entries from a previous day are evicted to make room", () => {
    let now = new Date("2026-11-19T10:00:00Z");
    const limiter = createClientLimiter(
      { requestsPerMinute: 5, charactersPerDay: 5, maxClients: 1 },
      () => now,
    );
    expect(limiter.allow("a", 1)).toBe(true);
    now = new Date("2026-11-20T10:00:00Z");
    expect(limiter.allow("b", 1)).toBe(true);
    expect(limiter.allow("b", 1)).toBe(true);
  });

  test("IPv6 addresses collapse to their /64 and IPv4-mapped ones to IPv4", () => {
    expect(normalizeClient("::ffff:203.0.113.5")).toBe("203.0.113.5");
    expect(normalizeClient("203.0.113.5")).toBe("203.0.113.5");
    expect(normalizeClient("2001:db8:1:2:aaaa:bbbb:cccc:dddd")).toBe("2001:0db8:0001:0002::/64");
    expect(normalizeClient("2001:DB8:1:2::1")).toBe("2001:0db8:0001:0002::/64");
    expect(normalizeClient("2001:db8:1:3::1")).toBe("2001:0db8:0001:0003::/64");
    expect(normalizeClient("::ffff:cb00:7105")).toBe("203.0.113.5");
    expect(normalizeClient("0:0:0:0:0:ffff:cb00:7105")).toBe("203.0.113.5");
    expect(normalizeClient("::203.0.113.5")).toBe("203.0.113.5");
    expect(normalizeClient("64:ff9b::cb00:7105")).toBe("203.0.113.5");
    expect(normalizeClient("64:ff9b::203.0.113.5")).toBe("203.0.113.5");
    expect(normalizeClient("::1")).toBe("0000:0000:0000:0000:0000:0000:0000:0001");
    expect(normalizeClient("fe80::1:2")).toBe("fe80:0000:0000:0000:0000:0000:0001:0002");
    expect(normalizeClient("fe80::1:3")).toBe("fe80:0000:0000:0000:0000:0000:0001:0003");
    expect(normalizeClient("not-an-ip")).toBe("not-an-ip");
  });
});
