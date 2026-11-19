import { type AccountDeps, authenticate, notConfigured } from "../auth/auth-routes";
import { json } from "../http";
import { MAX_PUSH_BYTES, parsePushBody } from "./records";
import type { SyncStore } from "./sync-store";

export interface SyncDeps extends AccountDeps {
  sync?: SyncStore;
}

export const MAX_PULL_LIMIT = 500;

function parseCount(raw: string | null, fallback: number, min: number, max: number) {
  if (raw === null) {
    return fallback;
  }
  const value = Number(raw);
  return /^\d{1,15}$/.test(raw) && value >= min && value <= max ? value : undefined;
}

export async function syncRoute(request: Request, url: URL, deps: SyncDeps): Promise<Response> {
  const isPush = url.pathname === "/sync/push";
  const isPull = url.pathname === "/sync/pull";
  if (!isPush && !isPull) {
    return json({ error: "not_found" }, 404, deps);
  }
  if (request.method !== (isPush ? "POST" : "GET")) {
    return json({ error: "method_not_allowed" }, 405, deps);
  }
  if (!deps.auth || !deps.sync) {
    return notConfigured(deps);
  }
  const session = await authenticate(request, deps);
  if (session instanceof Response) {
    return session;
  }
  return isPush
    ? pushRoute(request, deps, deps.sync, session.user.id)
    : pullRoute(url, deps, deps.sync, session.user.id);
}

async function pushRoute(
  request: Request,
  deps: SyncDeps,
  store: SyncStore,
  userId: string,
): Promise<Response> {
  const declared = Number(request.headers.get("content-length") ?? Number.NaN);
  if (!Number.isFinite(declared) || declared > MAX_PUSH_BYTES) {
    return json({ error: "payload_too_large" }, 413, deps);
  }
  const raw = new Uint8Array(await request.arrayBuffer());
  if (raw.length > MAX_PUSH_BYTES) {
    return json({ error: "payload_too_large" }, 413, deps);
  }
  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return json({ error: "invalid_body" }, 400, deps);
  }
  const records = parsePushBody(body);
  if (!records) {
    return json({ error: "invalid_record" }, 400, deps);
  }
  return json(await store.push(userId, records), 200, deps);
}

async function pullRoute(
  url: URL,
  deps: SyncDeps,
  store: SyncStore,
  userId: string,
): Promise<Response> {
  const since = parseCount(url.searchParams.get("since"), 0, 0, Number.MAX_SAFE_INTEGER);
  const limit = parseCount(url.searchParams.get("limit"), MAX_PULL_LIMIT, 1, MAX_PULL_LIMIT);
  if (since === undefined || limit === undefined) {
    return json({ error: "invalid_query" }, 400, deps);
  }
  return json(await store.pull(userId, since, limit), 200, deps);
}
