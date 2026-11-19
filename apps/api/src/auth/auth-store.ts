import type { SQL } from "bun";
import type { GoogleProfile } from "./google-verifier";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
}

export interface SessionRecord {
  user: AuthUser;
  expiresAt: number;
}

export interface AuthStore {
  upsertUser(profile: GoogleProfile): Promise<AuthUser>;
  createSession(userId: string, tokenHash: string, expiresAt: number, now: number): Promise<void>;
  findSession(tokenHash: string, now: number): Promise<SessionRecord | undefined>;
  extendSession(tokenHash: string, expiresAt: number): Promise<void>;
  deleteSession(tokenHash: string): Promise<void>;
}

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
}

function toUser(row: UserRow): AuthUser {
  return { id: row.id, email: row.email, name: row.name, picture: row.picture };
}

export function createSqlAuthStore(sql: SQL): AuthStore {
  return {
    async upsertUser(profile) {
      const rows: UserRow[] = await sql`
        INSERT INTO app_user (google_sub, email, name, picture)
        VALUES (${profile.sub}, ${profile.email}, ${profile.name}, ${profile.picture})
        ON CONFLICT (google_sub) DO UPDATE
          SET email = EXCLUDED.email, name = EXCLUDED.name, picture = EXCLUDED.picture
        RETURNING id, email, name, picture`;
      return toUser(rows[0] as UserRow);
    },
    async createSession(userId, tokenHash, expiresAt, now) {
      await sql`DELETE FROM session WHERE expires_at < ${now}`;
      await sql`
        INSERT INTO session (token_hash, user_id, expires_at)
        VALUES (${tokenHash}, ${userId}, ${expiresAt})`;
    },
    async findSession(tokenHash, now) {
      const rows: (UserRow & { expires_at: string | number })[] = await sql`
        SELECT u.id, u.email, u.name, u.picture, s.expires_at
        FROM session s JOIN app_user u ON u.id = s.user_id
        WHERE s.token_hash = ${tokenHash} AND s.expires_at > ${now}`;
      const row = rows[0];
      return row ? { user: toUser(row), expiresAt: Number(row.expires_at) } : undefined;
    },
    async extendSession(tokenHash, expiresAt) {
      await sql`UPDATE session SET expires_at = ${expiresAt} WHERE token_hash = ${tokenHash}`;
    },
    async deleteSession(tokenHash) {
      await sql`DELETE FROM session WHERE token_hash = ${tokenHash}`;
    },
  };
}
