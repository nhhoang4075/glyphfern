import { type JWK, SignJWT, exportJWK, generateKeyPair } from "jose";
import type { AuthDeps } from "../../src/auth/auth-routes";
import type { AuthStore, AuthUser, SessionRecord } from "../../src/auth/auth-store";
import { createGoogleVerifier } from "../../src/auth/google-verifier";

export const CLIENT_ID = "client-123.apps.googleusercontent.com";
export const OWNER_EMAIL = "owner@example.com";
export const SECOND_EMAIL = "second@example.com";
export const ORIGIN = "http://localhost:5183";

export interface TestKeys {
  sign(claims: Record<string, unknown>, options?: SignOptions): Promise<string>;
  jwks: { keys: JWK[] };
}

interface SignOptions {
  issuer?: string;
  audience?: string;
  expiresInSeconds?: number;
  wrongKey?: boolean;
}

export async function createTestKeys(): Promise<TestKeys> {
  const pair = await generateKeyPair("RS256", { extractable: true });
  const other = await generateKeyPair("RS256", { extractable: true });
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "RS256", use: "sig" };
  return {
    jwks: { keys: [jwk] },
    async sign(claims, options = {}) {
      const nowSeconds = Math.floor(Date.now() / 1000);
      return new SignJWT(claims)
        .setProtectedHeader({ alg: "RS256", kid: "k1" })
        .setIssuer(options.issuer ?? "https://accounts.google.com")
        .setAudience(options.audience ?? CLIENT_ID)
        .setIssuedAt(nowSeconds - 10)
        .setExpirationTime(nowSeconds + (options.expiresInSeconds ?? 600))
        .sign(options.wrongKey ? other.privateKey : pair.privateKey);
    },
  };
}

export function createMemoryAuthStore(): AuthStore & { sessionCount(): number } {
  const users = new Map<string, AuthUser & { sub: string }>();
  const sessions = new Map<string, { userId: string; expiresAt: number }>();
  return {
    sessionCount: () => sessions.size,
    async upsertUser(profile) {
      const existing = [...users.values()].find((user) => user.sub === profile.sub);
      const user = {
        id: existing?.id ?? crypto.randomUUID(),
        sub: profile.sub,
        email: profile.email,
        name: profile.name,
        picture: profile.picture,
      };
      users.set(user.id, user);
      return { id: user.id, email: user.email, name: user.name, picture: user.picture };
    },
    async createSession(userId, tokenHash, expiresAt) {
      sessions.set(tokenHash, { userId, expiresAt });
    },
    async findSession(tokenHash, now): Promise<SessionRecord | undefined> {
      const session = sessions.get(tokenHash);
      const user = session ? users.get(session.userId) : undefined;
      if (!session || !user || session.expiresAt <= now) {
        return undefined;
      }
      return {
        user: { id: user.id, email: user.email, name: user.name, picture: user.picture },
        expiresAt: session.expiresAt,
      };
    },
    async extendSession(tokenHash, expiresAt) {
      const session = sessions.get(tokenHash);
      if (session) {
        session.expiresAt = expiresAt;
      }
    },
    async deleteSession(tokenHash) {
      sessions.delete(tokenHash);
    },
  };
}

export function createAuthDeps(
  keys: TestKeys,
  store: AuthStore,
  clock: { now: number } = { now: Date.now() },
): AuthDeps {
  return {
    clientId: CLIENT_ID,
    allowedEmails: [OWNER_EMAIL, SECOND_EMAIL],
    store,
    verifier: createGoogleVerifier(
      async () => keys.jwks,
      () => clock.now,
    ),
    now: () => clock.now,
  };
}

export function claims(email: string, extra: Record<string, unknown> = {}) {
  return {
    sub: `sub-${email}`,
    email,
    email_verified: true,
    name: "Test User",
    picture: "https://example.com/p.png",
    ...extra,
  };
}
