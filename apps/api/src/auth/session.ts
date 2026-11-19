export const SESSION_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;
export const SESSION_EXTEND_BELOW_MS = 30 * 24 * 60 * 60 * 1000;
const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function generateToken(): string {
  return new Uint8Array(crypto.getRandomValues(new Uint8Array(TOKEN_BYTES))).toBase64({
    alphabet: "base64url",
    omitPadding: true,
  });
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return new Uint8Array(digest).toHex();
}

export function readBearerToken(header: string | null): string | undefined {
  if (!header?.startsWith("Bearer ")) {
    return undefined;
  }
  const token = header.slice("Bearer ".length);
  return TOKEN_PATTERN.test(token) ? token : undefined;
}
