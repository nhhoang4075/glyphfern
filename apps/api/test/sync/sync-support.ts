import { beforeAll } from "bun:test";
import { handle } from "../../src/handler";
import type { LemmaStore } from "../../src/lexicon/lemmas";
import type { LexiconStore } from "../../src/lexicon/lookup";
import {
  ORIGIN,
  OWNER_EMAIL,
  SECOND_EMAIL,
  type TestKeys,
  claims,
  createAuthDeps,
  createMemoryAuthStore,
  createTestKeys,
} from "../auth/auth-support";
import { createMemorySyncStore } from "./memory-sync-store";

const lexicon: LexiconStore & LemmaStore = {
  async findForms() {
    return [];
  },
  async findByWord() {
    return [];
  },
};

export interface Api {
  call(path: string, token: string | undefined, init?: RequestInit): Promise<Response>;
  owner: string;
  second: string;
}

let keys: TestKeys;

export function useKeys() {
  beforeAll(async () => {
    keys = await createTestKeys();
  });
}

export async function createApi(): Promise<Api> {
  const deps = {
    store: lexicon,
    allowedOrigin: ORIGIN,
    auth: createAuthDeps(keys, createMemoryAuthStore()),
    sync: createMemorySyncStore(),
  };
  const call = (path: string, token: string | undefined, init: RequestInit = {}) =>
    handle(
      new Request(`http://api.test${path}`, {
        ...init,
        headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...init.headers },
      }),
      deps,
    );
  async function signIn(email: string) {
    const credential = await keys.sign(claims(email));
    const response = await handle(
      new Request("http://api.test/auth/google", {
        method: "POST",
        headers: {
          "content-length": String(new TextEncoder().encode(JSON.stringify({ credential })).length),
        },
        body: JSON.stringify({ credential }),
      }),
      deps,
    );
    return ((await response.json()) as { token: string }).token;
  }
  return { call, owner: await signIn(OWNER_EMAIL), second: await signIn(SECOND_EMAIL) };
}

export function push(api: Api, token: string, records: unknown[]) {
  const body = JSON.stringify({ records });
  return api.call("/sync/push", token, {
    method: "POST",
    headers: { "content-length": String(new TextEncoder().encode(body).length) },
    body,
  });
}
