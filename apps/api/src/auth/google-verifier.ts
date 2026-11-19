import { type JSONWebKeySet, createLocalJWKSet, jwtVerify } from "jose";

export const GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const DEFAULT_MAX_AGE_SECONDS = 3600;

export type KeyFetcher = () => Promise<JSONWebKeySet>;

export interface GoogleProfile {
  sub: string;
  email: string;
  name: string | null;
  picture: string | null;
}

export type VerifyResult = { ok: true; profile: GoogleProfile } | { ok: false; reason: "invalid" };

export interface IdTokenVerifier {
  verify(credential: string, clientId: string): Promise<VerifyResult>;
}

function maxAgeSeconds(header: string | null): number {
  const match = /max-age=(\d+)/.exec(header ?? "");
  return match?.[1] ? Number(match[1]) : DEFAULT_MAX_AGE_SECONDS;
}

export function createCachedKeyFetcher(
  fetchImpl: typeof fetch = fetch,
  now: () => number = Date.now,
  url = GOOGLE_CERTS_URL,
): KeyFetcher {
  let cached: { keys: JSONWebKeySet; expiresAt: number } | undefined;
  return async () => {
    if (cached && cached.expiresAt > now()) {
      return cached.keys;
    }
    const response = await fetchImpl(url);
    if (!response.ok) {
      throw new Error(`key fetch failed with status ${response.status}`);
    }
    const keys = (await response.json()) as JSONWebKeySet;
    cached = {
      keys,
      expiresAt: now() + maxAgeSeconds(response.headers.get("cache-control")) * 1000,
    };
    return keys;
  };
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function createGoogleVerifier(
  fetchKeys: KeyFetcher,
  now: () => number = Date.now,
): IdTokenVerifier {
  return {
    async verify(credential, clientId) {
      try {
        const keys = createLocalJWKSet(await fetchKeys());
        const { payload } = await jwtVerify(credential, keys, {
          algorithms: ["RS256"],
          issuer: GOOGLE_ISSUERS,
          audience: clientId,
          currentDate: new Date(now()),
        });
        const email = text(payload.email);
        const sub = text(payload.sub);
        const verified = payload.email_verified === true || payload.email_verified === "true";
        if (!email || !sub || !verified || payload.exp === undefined) {
          return { ok: false, reason: "invalid" };
        }
        return {
          ok: true,
          profile: {
            sub,
            email: email.toLowerCase(),
            name: text(payload.name),
            picture: text(payload.picture),
          },
        };
      } catch {
        return { ok: false, reason: "invalid" };
      }
    },
  };
}
