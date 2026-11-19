import { type CorsDeps, empty, json } from "../http";
import type { AuthStore, AuthUser } from "./auth-store";
import type { IdTokenVerifier } from "./google-verifier";
import {
  SESSION_EXTEND_BELOW_MS,
  SESSION_LIFETIME_MS,
  generateToken,
  hashToken,
  readBearerToken,
} from "./session";

export interface AuthDeps {
  clientId: string;
  allowedEmails: string[];
  store: AuthStore;
  verifier: IdTokenVerifier;
  now?: () => number;
}

export interface AccountDeps extends CorsDeps {
  auth?: AuthDeps;
}

export interface Authenticated {
  user: AuthUser;
  tokenHash: string;
  expiresAt: number;
}

const MAX_CREDENTIAL_CHARS = 8192;

function publicUser(user: AuthUser) {
  return { email: user.email, name: user.name, picture: user.picture };
}

export function notConfigured(deps: CorsDeps): Response {
  return json({ error: "auth_not_configured" }, 503, deps);
}

export async function authenticate(
  request: Request,
  deps: AccountDeps,
): Promise<Authenticated | Response> {
  const auth = deps.auth;
  if (!auth) {
    return notConfigured(deps);
  }
  const unauthorized = () => json({ error: "unauthorized" }, 401, deps);
  const token = readBearerToken(request.headers.get("authorization"));
  if (!token) {
    return unauthorized();
  }
  const tokenHash = await hashToken(token);
  const session = await auth.store.findSession(tokenHash, (auth.now ?? Date.now)());
  if (!session) {
    return unauthorized();
  }
  return { user: session.user, tokenHash, expiresAt: session.expiresAt };
}

export async function authRoute(request: Request, url: URL, deps: AccountDeps): Promise<Response> {
  const auth = deps.auth;
  if (url.pathname === "/auth/config") {
    if (request.method !== "GET") {
      return json({ error: "method_not_allowed" }, 405, deps);
    }
    return json({ googleClientId: auth?.clientId ?? null }, 200, deps);
  }
  if (url.pathname === "/auth/google") {
    return request.method === "POST"
      ? googleRoute(request, deps)
      : json({ error: "method_not_allowed" }, 405, deps);
  }
  if (url.pathname === "/auth/me") {
    return request.method === "GET"
      ? meRoute(request, deps)
      : json({ error: "method_not_allowed" }, 405, deps);
  }
  if (url.pathname === "/auth/logout") {
    return request.method === "POST"
      ? logoutRoute(request, deps)
      : json({ error: "method_not_allowed" }, 405, deps);
  }
  return json({ error: "not_found" }, 404, deps);
}

async function googleRoute(request: Request, deps: AccountDeps): Promise<Response> {
  const auth = deps.auth;
  if (!auth) {
    return notConfigured(deps);
  }
  let credential: unknown;
  try {
    credential = ((await request.json()) as { credential?: unknown }).credential;
  } catch {
    return json({ error: "invalid_credential" }, 401, deps);
  }
  if (
    typeof credential !== "string" ||
    credential.length === 0 ||
    credential.length > MAX_CREDENTIAL_CHARS
  ) {
    return json({ error: "invalid_credential" }, 401, deps);
  }
  const result = await auth.verifier.verify(credential, auth.clientId);
  if (!result.ok) {
    return json({ error: "invalid_credential" }, 401, deps);
  }
  if (!auth.allowedEmails.includes(result.profile.email)) {
    return json({ error: "not_allowed" }, 403, deps);
  }
  const now = (auth.now ?? Date.now)();
  const user = await auth.store.upsertUser(result.profile);
  const token = generateToken();
  const expiresAt = now + SESSION_LIFETIME_MS;
  await auth.store.createSession(user.id, await hashToken(token), expiresAt, now);
  return json({ token, expiresAt, user: publicUser(user) }, 200, deps);
}

async function meRoute(request: Request, deps: AccountDeps): Promise<Response> {
  const session = await authenticate(request, deps);
  if (session instanceof Response) {
    return session;
  }
  const auth = deps.auth;
  const now = (auth?.now ?? Date.now)();
  let expiresAt = session.expiresAt;
  if (auth && expiresAt - now < SESSION_EXTEND_BELOW_MS) {
    expiresAt = now + SESSION_LIFETIME_MS;
    await auth.store.extendSession(session.tokenHash, expiresAt);
  }
  return json({ user: publicUser(session.user) }, 200, deps);
}

async function logoutRoute(request: Request, deps: AccountDeps): Promise<Response> {
  const session = await authenticate(request, deps);
  if (session instanceof Response) {
    return session;
  }
  await deps.auth?.store.deleteSession(session.tokenHash);
  return empty(204, deps);
}
