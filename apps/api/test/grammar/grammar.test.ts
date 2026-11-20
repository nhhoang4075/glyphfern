import { describe, expect, test } from "bun:test";
import { hashToken } from "../../src/auth/session";
import { createGatewayGrammarClient } from "../../src/grammar/gateway-client";
import { type GrammarClient, GrammarClientError } from "../../src/grammar/grammar-client";
import {
  type GrammarCache,
  createGrammarService,
  grammarCacheKey,
} from "../../src/grammar/grammar-service";
import { parseNotes } from "../../src/grammar/parse-notes";
import { handle } from "../../src/handler";
import { createClientLimiter } from "../../src/translate/client-limiter";
import { createDailyBudget, hashText } from "../../src/translate/translate-service";
import {
  OWNER_EMAIL,
  createAuthDeps,
  createMemoryAuthStore,
  createTestKeys,
} from "../auth/auth-support";

const TOKEN = "T".repeat(43);
const authStore = createMemoryAuthStore();
const authDeps = createAuthDeps(await createTestKeys(), authStore);
const owner = await authStore.upsertUser({
  sub: "sub-owner",
  email: OWNER_EMAIL,
  name: "Owner",
  picture: "",
});
await authStore.createSession(owner.id, await hashToken(TOKEN), Date.now() + 3_600_000);

const REQUEST = { lang: "es", sentence: "Ella miraba el mar.", word: "miraba", lemma: "mirar" };

function memoryCache(): GrammarCache & { hashes: () => string[] } {
  const map = new Map<string, string[]>();
  return {
    async get(hash) {
      return map.get(hash);
    },
    async put(hash, notes) {
      map.set(hash, notes);
    },
    hashes: () => [...map.keys()],
  };
}

function fakeClient(): GrammarClient & { calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    model: "fake/model",
    calls,
    async analyze(request) {
      calls.push(request);
      return ["Pretérito imperfecto.", "Ngôi thứ ba số ít."];
    },
  };
}

function failingClient(): GrammarClient {
  return {
    model: "fake/model",
    async analyze() {
      throw new GrammarClientError("down");
    },
  };
}

function post(
  body: unknown,
  deps: Parameters<typeof handle>[1],
  client = "1.1.1.1",
  token: string | null = TOKEN,
) {
  const text = JSON.stringify(body);
  return handle(
    new Request("http://api.test/grammar", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(text.length),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: text,
    }),
    deps,
    client,
  );
}

function depsWith(grammar: ReturnType<typeof createGrammarService> | undefined) {
  return {
    store: {} as never,
    allowedOrigin: "http://web.test",
    auth: authDeps,
    ...(grammar ? { grammar } : {}),
  };
}

describe("grammar notes parser", () => {
  test("a plain array is accepted and trimmed", () => {
    expect(parseNotes('[" a ", "b"]')).toEqual(["a", "b"]);
  });

  test("code fences are stripped", () => {
    expect(parseNotes('```json\n["a", "b"]\n```')).toEqual(["a", "b"]);
  });

  test("more than four notes are cut to four", () => {
    expect(parseNotes('["1","2","3","4","5"]')).toEqual(["1", "2", "3", "4"]);
  });

  test("anything that is not an array of non-empty strings is rejected", () => {
    expect(parseNotes("not json")).toBeUndefined();
    expect(parseNotes('{"notes":["a"]}')).toBeUndefined();
    expect(parseNotes('["a", 3]')).toBeUndefined();
    expect(parseNotes('["a", "  "]')).toBeUndefined();
    expect(parseNotes("[]")).toBeUndefined();
  });
});

describe("grammar service", () => {
  test("a miss calls the client and stores the notes under the documented key", async () => {
    const client = fakeClient();
    const cache = memoryCache();
    const service = createGrammarService(client, cache, createDailyBudget(1000));
    const result = await service.analyze(REQUEST);
    expect(result.cached).toBe(false);
    expect(client.calls).toEqual([REQUEST]);
    expect(cache.hashes()).toEqual([
      await hashText("fake/model|es|mirar|miraba|Ella miraba el mar."),
    ]);
    expect(cache.hashes()[0]).toBe(await grammarCacheKey("fake/model", REQUEST));
  });

  test("a hit never calls the client and does not consume budget", async () => {
    const client = fakeClient();
    const budget = createDailyBudget(REQUEST.sentence.length);
    const service = createGrammarService(client, memoryCache(), budget);
    await service.analyze(REQUEST);
    const again = await service.analyze(REQUEST);
    expect(again.cached).toBe(true);
    expect(client.calls).toHaveLength(1);
    expect(budget.tryConsume(1)).toBe(false);
  });
});

describe("POST /grammar", () => {
  const ok = () =>
    depsWith(createGrammarService(fakeClient(), memoryCache(), createDailyBudget(1000)));

  test("answers the notes", async () => {
    const response = await post(REQUEST, ok());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      notes: ["Pretérito imperfecto.", "Ngôi thứ ba số ít."],
    });
  });

  test("answers 401 without a session and never calls the service", async () => {
    const client = fakeClient();
    const deps = depsWith(createGrammarService(client, memoryCache(), createDailyBudget(1000)));
    expect((await post(REQUEST, deps, "1.1.1.1", null)).status).toBe(401);
    expect((await post(REQUEST, deps, "1.1.1.1", "x".repeat(43))).status).toBe(401);
    expect(client.calls).toHaveLength(0);
  });

  test("two words of one sentence never share cached notes", async () => {
    const cache = memoryCache();
    const service = createGrammarService(fakeClient(), cache, createDailyBudget(1000));
    await service.analyze(REQUEST);
    await service.analyze({ ...REQUEST, word: "mar", lemma: "mar" });
    expect(cache.hashes()).toHaveLength(2);
  });

  test("answers 503 when no grammar service is configured", async () => {
    expect((await post(REQUEST, depsWith(undefined))).status).toBe(503);
  });

  test("rejects invalid bodies with 400", async () => {
    const cases = [
      { ...REQUEST, lang: "fr" },
      { ...REQUEST, sentence: "" },
      { ...REQUEST, sentence: "x".repeat(501) },
      { ...REQUEST, word: "" },
      { ...REQUEST, word: "w".repeat(61) },
      { ...REQUEST, lemma: "" },
      { ...REQUEST, lemma: 4 },
      { lang: "es" },
    ];
    for (const body of cases) {
      expect((await post(body, ok())).status).toBe(400);
    }
  });

  test("answers 429 when the client limiter refuses", async () => {
    const limiter = createClientLimiter({ requestsPerMinute: 1, charactersPerDay: 10_000 });
    const deps = { ...ok(), limiter };
    expect((await post(REQUEST, deps)).status).toBe(200);
    expect((await post(REQUEST, deps)).status).toBe(429);
  });

  test("answers 429 when the daily budget is used up and 200 for cached sentences", async () => {
    const service = createGrammarService(fakeClient(), memoryCache(), createDailyBudget(20));
    const deps = depsWith(service);
    expect((await post(REQUEST, deps)).status).toBe(200);
    const other = { ...REQUEST, sentence: "Ella miraba el mar otra vez.", lemma: "mirar" };
    expect((await post(other, deps)).status).toBe(429);
    expect((await post(REQUEST, deps)).status).toBe(200);
  });

  test("answers 502 when the client fails", async () => {
    const service = createGrammarService(failingClient(), memoryCache(), createDailyBudget(1000));
    expect((await post(REQUEST, depsWith(service))).status).toBe(502);
  });
});

describe("gateway grammar client", () => {
  function gateway(reply: () => Response, seen: { url?: string; init?: RequestInit } = {}) {
    return createGatewayGrammarClient({
      apiKey: "test-key",
      model: "m/x",
      fetcher: (async (url: string, init: RequestInit) => {
        seen.url = url;
        seen.init = init;
        return reply();
      }) as unknown as typeof fetch,
    });
  }
  const completion = (content: string) =>
    new Response(JSON.stringify({ choices: [{ message: { content } }] }));

  test("posts the documented request and parses a fenced answer", async () => {
    const seen: { url?: string; init?: RequestInit } = {};
    const client = gateway(() => completion('```json\n["a","b"]\n```'), seen);
    expect(await client.analyze(REQUEST)).toEqual(["a", "b"]);
    expect(seen.url).toBe("https://ai-gateway.vercel.sh/v1/chat/completions");
    const headers = seen.init?.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer test-key");
    const body = JSON.parse(String(seen.init?.body));
    expect(body.model).toBe("m/x");
    expect(body.temperature).toBe(0.2);
    expect(body.max_tokens).toBe(1500);
    expect(body.messages).toHaveLength(2);
    const sent = JSON.parse(body.messages[1].content);
    expect(sent).toEqual(REQUEST);
  });

  test("invalid output and failed statuses raise GrammarClientError", async () => {
    await expect(gateway(() => completion("sorry")).analyze(REQUEST)).rejects.toBeInstanceOf(
      GrammarClientError,
    );
    await expect(
      gateway(() => new Response("no", { status: 500 })).analyze(REQUEST),
    ).rejects.toBeInstanceOf(GrammarClientError);
  });
});
