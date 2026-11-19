import { beforeAll, describe, expect, test } from "bun:test";
import { createCachedKeyFetcher } from "../../src/auth/google-verifier";
import { hashToken } from "../../src/auth/session";
import { readConfig } from "../../src/config";
import { handle } from "../../src/handler";
import type { LemmaStore } from "../../src/lexicon/lemmas";
import type { LexiconStore } from "../../src/lexicon/lookup";
import { createMemorySyncStore } from "../sync/memory-sync-store";
import {
  CLIENT_ID,
  ORIGIN,
  OWNER_EMAIL,
  type TestKeys,
  claims,
  createAuthDeps,
  createMemoryAuthStore,
  createTestKeys,
} from "./auth-support";

const lexicon: LexiconStore & LemmaStore = {
  async findForms() {
    return [];
  },
  async findByWord() {
    return [];
  },
};

let keys: TestKeys;
beforeAll(async () => {
  keys = await createTestKeys();
});

function setup() {
  const store = createMemoryAuthStore();
  const clock = { now: Date.now() };
  const deps = {
    store: lexicon,
    allowedOrigin: ORIGIN,
    auth: createAuthDeps(keys, store, clock),
    sync: createMemorySyncStore(),
  };
  const call = (path: string, init: RequestInit = {}) =>
    handle(new Request(`http://api.test${path}`, init), deps);
  const signIn = (credential: string) =>
    call("/auth/google", { method: "POST", body: JSON.stringify({ credential }) });
  return { store, clock, deps, call, signIn };
}

describe("google token verification", () => {
  test("a valid token for an allowed email signs in", async () => {
    const { signIn } = setup();
    const response = await signIn(await keys.sign(claims(OWNER_EMAIL)));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { token: string; expiresAt: number; user: unknown };
    expect(body.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(body.user).toEqual({
      email: OWNER_EMAIL,
      name: "Test User",
      picture: "https://example.com/p.png",
    });
  });

  test("the email is lowercased before the allow-list check", async () => {
    const { signIn } = setup();
    const response = await signIn(await keys.sign(claims("Owner@Example.com")));
    expect(response.status).toBe(200);
  });

  test("the accounts.google.com issuer without scheme is accepted", async () => {
    const { signIn } = setup();
    const token = await keys.sign(claims(OWNER_EMAIL), { issuer: "accounts.google.com" });
    expect((await signIn(token)).status).toBe(200);
  });

  const rejected: [string, () => Promise<string>][] = [
    ["a bad signature", () => keys.sign(claims(OWNER_EMAIL), { wrongKey: true })],
    ["a wrong audience", () => keys.sign(claims(OWNER_EMAIL), { audience: "other-client" })],
    ["a wrong issuer", () => keys.sign(claims(OWNER_EMAIL), { issuer: "https://evil.example" })],
    ["an expired token", () => keys.sign(claims(OWNER_EMAIL), { expiresInSeconds: -60 })],
    ["an unverified email", () => keys.sign(claims(OWNER_EMAIL, { email_verified: false }))],
    ["garbage", async () => "not.a.jwt"],
  ];
  for (const [name, make] of rejected) {
    test(`${name} answers 401 invalid_credential and creates no session`, async () => {
      const { signIn, store } = setup();
      const response = await signIn(await make());
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "invalid_credential" });
      expect(store.sessionCount()).toBe(0);
    });
  }

  test("a verified email outside the list answers 403 not_allowed", async () => {
    const { signIn, store } = setup();
    const response = await signIn(await keys.sign(claims("stranger@example.com")));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "not_allowed" });
    expect(store.sessionCount()).toBe(0);
  });

  test("a missing or malformed body answers 401 invalid_credential", async () => {
    const { call } = setup();
    for (const body of ["", "{", "{}", JSON.stringify({ credential: 5 })]) {
      const response = await call("/auth/google", { method: "POST", body });
      expect(response.status).toBe(401);
    }
  });

  test("the key fetcher caches by max-age and refetches after it", async () => {
    let fetches = 0;
    let now = 1_000_000;
    const fetchImpl = (async () => {
      fetches += 1;
      return new Response(JSON.stringify(keys.jwks), {
        headers: { "cache-control": "public, max-age=60" },
      });
    }) as unknown as typeof fetch;
    const fetchKeys = createCachedKeyFetcher(fetchImpl, () => now);
    await fetchKeys();
    now += 59_000;
    await fetchKeys();
    expect(fetches).toBe(1);
    now += 2_000;
    await fetchKeys();
    expect(fetches).toBe(2);
  });
});

describe("session lifecycle", () => {
  async function session() {
    const ctx = setup();
    const response = await ctx.signIn(await keys.sign(claims(OWNER_EMAIL)));
    const body = (await response.json()) as { token: string; expiresAt: number };
    const auth = { authorization: `Bearer ${body.token}` };
    return { ...ctx, token: body.token, expiresAt: body.expiresAt, auth };
  }

  test("only the SHA-256 of the token is stored and the lifetime is 90 days", async () => {
    const { token, expiresAt, clock, store } = await session();
    expect(expiresAt - clock.now).toBe(90 * 24 * 3600 * 1000);
    expect(await store.findSession(await hashToken(token), clock.now)).toBeDefined();
    expect(await store.findSession(token, clock.now)).toBeUndefined();
  });

  test("me returns the user and logout ends the session with 204", async () => {
    const { call, auth } = await session();
    const me = await call("/auth/me", { headers: auth });
    expect(me.status).toBe(200);
    expect(((await me.json()) as { user: { email: string } }).user.email).toBe(OWNER_EMAIL);
    expect((await call("/auth/logout", { method: "POST", headers: auth })).status).toBe(204);
    expect((await call("/auth/me", { headers: auth })).status).toBe(401);
  });

  test("me extends the session once less than 30 days remain", async () => {
    const { call, auth, clock, store, token } = await session();
    clock.now += 40 * 24 * 3600 * 1000;
    await call("/auth/me", { headers: auth });
    const hash = await hashToken(token);
    const initial = (await store.findSession(hash, clock.now))?.expiresAt ?? 0;
    expect(initial - clock.now).toBe(50 * 24 * 3600 * 1000);
    clock.now += 25 * 24 * 3600 * 1000;
    await call("/auth/me", { headers: auth });
    const extended = (await store.findSession(hash, clock.now))?.expiresAt ?? 0;
    expect(extended - clock.now).toBe(90 * 24 * 3600 * 1000);
  });

  test("an expired session is refused", async () => {
    const { call, auth, clock } = await session();
    clock.now += 91 * 24 * 3600 * 1000;
    expect((await call("/auth/me", { headers: auth })).status).toBe(401);
  });

  test("signing in twice for the same account reuses the user", async () => {
    const { signIn, store } = setup();
    const first = await signIn(await keys.sign(claims(OWNER_EMAIL)));
    const second = await signIn(await keys.sign(claims(OWNER_EMAIL)));
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(store.sessionCount()).toBe(2);
  });
});

describe("protected routes", () => {
  const routes: [string, string][] = [
    ["GET", "/auth/me"],
    ["POST", "/auth/logout"],
    ["POST", "/sync/push"],
    ["GET", "/sync/pull"],
    ["PUT", "/books/abc"],
    ["GET", "/books/abc"],
    ["DELETE", "/books/abc"],
  ];
  const headers: Record<string, Record<string, string>> = {
    none: {},
    wrongScheme: { authorization: "Basic abc" },
    malformed: { authorization: "Bearer short" },
    unknown: { authorization: `Bearer ${"A".repeat(43)}` },
  };
  for (const [method, path] of routes) {
    for (const [name, header] of Object.entries(headers)) {
      test(`${method} ${path} with ${name} token answers 401 unauthorized`, async () => {
        const { call } = setup();
        const response = await call(path, { method, headers: header });
        expect(response.status).toBe(401);
        expect(await response.json()).toEqual({ error: "unauthorized" });
      });
    }
  }

  test("without GOOGLE_CLIENT_ID the routes answer 503 and config answers null", async () => {
    const bare = { store: lexicon, allowedOrigin: ORIGIN };
    const call = (path: string, init: RequestInit = {}) =>
      handle(new Request(`http://api.test${path}`, init), bare);
    const config = await call("/auth/config");
    expect(await config.json()).toEqual({ googleClientId: null });
    for (const [method, path] of [
      ["POST", "/auth/google"],
      ["GET", "/auth/me"],
      ["GET", "/sync/pull"],
      ["GET", "/books/abc"],
    ] as const) {
      const response = await call(path, { method });
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: "auth_not_configured" });
    }
  });

  test("config returns the client id and CORS allows Authorization, PUT and DELETE", async () => {
    const { call } = setup();
    expect(await (await call("/auth/config")).json()).toEqual({ googleClientId: CLIENT_ID });
    const preflight = await call("/sync/pull", { method: "OPTIONS" });
    expect(preflight.headers.get("access-control-allow-headers")).toContain("authorization");
    expect(preflight.headers.get("access-control-allow-methods")).toContain("PUT");
    expect(preflight.headers.get("access-control-allow-methods")).toContain("DELETE");
  });

  test("environment config lowercases the allowed emails", () => {
    const config = readConfig({ GOOGLE_CLIENT_ID: "x", ALLOWED_EMAILS: " A@B.com, c@d.com ,," });
    expect(config.allowedEmails).toEqual(["a@b.com", "c@d.com"]);
    expect(readConfig({}).googleClientId).toBeUndefined();
  });
});
