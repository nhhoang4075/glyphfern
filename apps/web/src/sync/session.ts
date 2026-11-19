export const SESSION_KEY = "glyphfern.session";

export interface SessionUser {
  email: string;
  name: string | null;
  picture: string | null;
}

export interface Session {
  token: string;
  user: SessionUser;
  expiresAt: number;
}

export interface SessionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function browserStorage(): SessionStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isSession(value: unknown): value is Session {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<Session>;
  return (
    typeof candidate.token === "string" &&
    candidate.token.length > 0 &&
    typeof candidate.user?.email === "string"
  );
}

export function readSession(storage: SessionStorage | null = browserStorage()): Session | null {
  try {
    const raw = storage?.getItem(SESSION_KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    return isSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeSession(
  session: Session,
  storage: SessionStorage | null = browserStorage(),
): void {
  try {
    storage?.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    return;
  }
}

export function clearSession(storage: SessionStorage | null = browserStorage()): void {
  try {
    storage?.removeItem(SESSION_KEY);
  } catch {
    return;
  }
}
