import { describe, expect, test } from "bun:test";
import { MemoryRepository } from "../../src/storage/memory-repository";
import { AccountController } from "../../src/sync/account";
import { HttpError } from "../../src/sync/http";
import { SyncRunner } from "../../src/sync/runner";
import { SESSION_KEY, type SessionStorage, readSession } from "../../src/sync/session";

function memoryStorage(initial: Record<string, string> = {}): SessionStorage & {
  data: Record<string, string>;
} {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

const SESSION = {
  token: "tok",
  expiresAt: 9_999_999_999,
  user: { email: "owner@example.com", name: "Owner", picture: null },
};

interface Call {
  url: string;
  method: string;
  authorization: string | null;
}

function fakeFetch(handler: (url: string, method: string) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetcher = async (url: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    const method = init?.method ?? "GET";
    calls.push({ url, method, authorization: headers.get("authorization") });
    return handler(url, method);
  };
  return { fetcher, calls };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function syncRoutes(url: string): Response | null {
  if (url.endsWith("/sync/push")) {
    return json({ accepted: 0, cursor: 0 });
  }
  if (url.includes("/sync/pull")) {
    return json({ records: [], books: [], cursor: 0, more: false });
  }
  return null;
}

async function settle() {
  for (let index = 0; index < 20; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

function controller(
  handler: Parameters<typeof fakeFetch>[0],
  storage: SessionStorage | null,
  baseUrl: string | null = "http://api",
) {
  const { fetcher, calls } = fakeFetch(handler);
  const repository = new MemoryRepository();
  const account = new AccountController({
    baseUrl: baseUrl ?? undefined,
    repository,
    reload: async () => undefined,
    fetcher,
    storage,
    debounceMs: 5,
  });
  return { account, calls, repository };
}

describe("account controller", () => {
  test("without an API base url sign-in is unavailable and nothing is fetched", async () => {
    const { account, calls } = controller(() => json({}), memoryStorage(), null);
    await account.start();
    expect(account.getSnapshot().googleClientId).toBeNull();
    expect(account.getSnapshot().session).toBeNull();
    expect(calls).toEqual([]);
  });

  test("a null googleClientId keeps the signed-out state without errors", async () => {
    const { account } = controller(
      (url) => (url.endsWith("/auth/config") ? json({ googleClientId: null }) : json({}, 500)),
      memoryStorage(),
    );
    await account.start();
    expect(account.getSnapshot()).toMatchObject({ googleClientId: null, session: null });
  });

  test("an unreachable config is reported as failed and retrying recovers", async () => {
    let online = false;
    const { account } = controller(() => {
      if (!online) {
        throw new Error("offline");
      }
      return json({ googleClientId: "cid" });
    }, memoryStorage());
    await account.start();
    expect(account.getSnapshot()).toMatchObject({ googleClientId: undefined, configFailed: true });
    online = true;
    await account.retryConfig();
    expect(account.getSnapshot()).toMatchObject({ googleClientId: "cid", configFailed: false });
  });

  test("signing in stores the session and starts a sync with the bearer token", async () => {
    const storage = memoryStorage();
    const { account, calls } = controller((url) => {
      if (url.endsWith("/auth/config")) {
        return json({ googleClientId: "cid" });
      }
      if (url.endsWith("/auth/google")) {
        return json(SESSION);
      }
      return syncRoutes(url) ?? json({}, 404);
    }, storage);
    await account.start();
    expect(account.getSnapshot().googleClientId).toBe("cid");
    await account.signIn("google-jwt");
    await settle();
    expect(readSession(storage)?.token).toBe("tok");
    expect(account.getSnapshot().session?.user.email).toBe("owner@example.com");
    expect(account.getSnapshot().status).toBe("synced");
    const pull = calls.find((call) => call.url.includes("/sync/pull"));
    expect(pull?.authorization).toBe("Bearer tok");
  });

  test("a rejected sign-in reports the reason and stores nothing", async () => {
    const storage = memoryStorage();
    const { account } = controller(
      (url) =>
        url.endsWith("/auth/google")
          ? json({ error: "not_allowed" }, 403)
          : json({ googleClientId: "c" }),
      storage,
    );
    await account.start();
    await account.signIn("jwt");
    expect(account.getSnapshot().signInError).toBe("not_allowed");
    expect(account.getSnapshot().session).toBeNull();
    expect(storage.data[SESSION_KEY]).toBeUndefined();
  });

  test("a stored session is validated on start and a 401 clears it", async () => {
    const storage = memoryStorage({ [SESSION_KEY]: JSON.stringify(SESSION) });
    const { account } = controller((url) => {
      if (url.endsWith("/auth/config")) {
        return json({ googleClientId: "cid" });
      }
      return json({ error: "unauthorized" }, 401);
    }, storage);
    await account.start();
    expect(account.getSnapshot().session).toBeNull();
    expect(storage.data[SESSION_KEY]).toBeUndefined();
  });

  test("a stored session survives an unreachable server", async () => {
    const storage = memoryStorage({ [SESSION_KEY]: JSON.stringify(SESSION) });
    const { account } = controller(() => {
      throw new Error("offline");
    }, storage);
    await account.start();
    await settle();
    expect(account.getSnapshot().session?.token).toBe("tok");
    expect(account.getSnapshot().status).toBe("failed");
  });

  test("a 401 during sync signs the user out and keeps local data", async () => {
    const storage = memoryStorage({ [SESSION_KEY]: JSON.stringify(SESSION) });
    const { account, repository } = controller((url) => {
      if (url.endsWith("/auth/config")) {
        return json({ googleClientId: "cid" });
      }
      if (url.endsWith("/auth/me")) {
        return json({ user: SESSION.user });
      }
      return json({ error: "unauthorized" }, 401);
    }, storage);
    await repository.saveBookmarks("es", [3]);
    await account.start();
    await settle();
    expect(account.getSnapshot().session).toBeNull();
    expect(storage.data[SESSION_KEY]).toBeUndefined();
    expect((await repository.loadLanguage("es")).bookmarks).toEqual([3]);
  });

  test("signing out calls logout then clears the session and keeps local data", async () => {
    const storage = memoryStorage({ [SESSION_KEY]: JSON.stringify(SESSION) });
    const { account, calls, repository } = controller((url) => {
      if (url.endsWith("/auth/config")) {
        return json({ googleClientId: "cid" });
      }
      if (url.endsWith("/auth/me")) {
        return json({ user: SESSION.user });
      }
      if (url.endsWith("/auth/logout")) {
        return new Response(null, { status: 204 });
      }
      return syncRoutes(url) ?? json({}, 404);
    }, storage);
    await repository.saveBookmarks("es", [3]);
    await account.start();
    await settle();
    await account.signOut();
    expect(calls.some((call) => call.url.endsWith("/auth/logout") && call.method === "POST")).toBe(
      true,
    );
    expect(account.getSnapshot().session).toBeNull();
    expect(storage.data[SESSION_KEY]).toBeUndefined();
    expect((await repository.loadLanguage("es")).bookmarks).toEqual([3]);
  });

  test("local writes schedule a debounced sync", async () => {
    const storage = memoryStorage({ [SESSION_KEY]: JSON.stringify(SESSION) });
    const { account, calls, repository } = controller((url) => {
      if (url.endsWith("/auth/config")) {
        return json({ googleClientId: "cid" });
      }
      if (url.endsWith("/auth/me")) {
        return json({ user: SESSION.user });
      }
      return syncRoutes(url) ?? json({}, 404);
    }, storage);
    await account.start();
    await settle();
    const before = calls.filter((call) => call.url.endsWith("/sync/push")).length;
    await repository.saveBookmarks("es", [1]);
    await repository.saveBookmarks("es", [1, 2]);
    await new Promise((resolve) => setTimeout(resolve, 60));
    const after = calls.filter((call) => call.url.endsWith("/sync/push")).length;
    expect(after).toBe(before + 1);
  });
});

describe("sync runner", () => {
  test("runs coalesce: a trigger during a run causes exactly one more run", async () => {
    let runs = 0;
    let release: () => void = () => undefined;
    const runner = new SyncRunner({
      run: async () => {
        runs += 1;
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return { failed: false, changed: false };
      },
      onChanged: async () => undefined,
      onUnauthorized: () => undefined,
      onStatus: () => undefined,
    });
    const first = runner.trigger();
    void runner.trigger();
    void runner.trigger();
    release();
    await new Promise((resolve) => setTimeout(resolve, 0));
    release();
    await first;
    expect(runs).toBe(2);
  });

  test("a change refreshes the app, a failure reports failed, a 401 reports unauthorized", async () => {
    const statuses: string[] = [];
    let changed = 0;
    let unauthorized = 0;
    const outcomes: Array<() => Promise<{ failed: boolean; changed: boolean }>> = [
      async () => ({ failed: false, changed: true }),
      async () => {
        throw new Error("down");
      },
      async () => {
        throw new HttpError(401, "unauthorized");
      },
    ];
    const runner = new SyncRunner({
      run: () => (outcomes.shift() as () => Promise<{ failed: boolean; changed: boolean }>)(),
      onChanged: async () => {
        changed += 1;
      },
      onUnauthorized: () => {
        unauthorized += 1;
      },
      onStatus: (status) => statuses.push(status),
    });
    await runner.trigger();
    await runner.trigger();
    await runner.trigger();
    expect(statuses).toEqual(["syncing", "synced", "syncing", "failed", "syncing"]);
    expect(changed).toBe(1);
    expect(unauthorized).toBe(1);
  });

  test("schedule debounces to one run", async () => {
    let runs = 0;
    const timers: Array<{ task: () => void; cancelled: boolean }> = [];
    const runner = new SyncRunner({
      run: async () => {
        runs += 1;
        return { failed: false, changed: false };
      },
      onChanged: async () => undefined,
      onUnauthorized: () => undefined,
      onStatus: () => undefined,
      setTimer: (task) => {
        const timer = { task, cancelled: false };
        timers.push(timer);
        return timer;
      },
      clearTimer: (handle) => {
        (handle as { cancelled: boolean }).cancelled = true;
      },
    });
    runner.schedule();
    runner.schedule();
    runner.schedule();
    for (const timer of timers) {
      if (!timer.cancelled) {
        timer.task();
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(timers.filter((timer) => !timer.cancelled)).toHaveLength(1);
    expect(runs).toBe(1);
  });
});

describe("session storage", () => {
  test("malformed or throwing storage reads as signed out", () => {
    expect(readSession(memoryStorage({ [SESSION_KEY]: "{not json" }))).toBeNull();
    expect(readSession(memoryStorage({ [SESSION_KEY]: JSON.stringify({ token: 3 }) }))).toBeNull();
    const throwing: SessionStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => undefined,
      removeItem: () => undefined,
    };
    expect(readSession(throwing)).toBeNull();
    expect(readSession(null)).toBeNull();
  });
});
