import type { SQL } from "bun";
import type { PushRecord, RecordKind } from "./records";

export const MAX_BOOKS_PER_USER = 50;
export const MAX_BOOK_BYTES_PER_USER = 200 * 1024 * 1024;

export interface PulledRecord {
  kind: RecordKind;
  key: string;
  payload: unknown;
  updatedAt: number;
  deleted: boolean;
  seq: number;
}

export interface PulledBook {
  id: string;
  lang: string;
  title: string;
  addedAt: number;
  seq: number;
  deleted: boolean;
  bytes: number;
}

export interface PullPage {
  records: PulledRecord[];
  books: PulledBook[];
  cursor: number;
  more: boolean;
}

export interface BookUpload {
  id: string;
  lang: string;
  title: string;
  addedAt: number;
  data: Uint8Array;
}

export interface SyncStore {
  push(userId: string, records: PushRecord[]): Promise<{ accepted: number; cursor: number }>;
  pull(userId: string, since: number, limit: number): Promise<PullPage>;
  putBook(userId: string, book: BookUpload): Promise<"stored" | "quota_exceeded">;
  getBook(userId: string, id: string): Promise<Uint8Array | undefined>;
  deleteBook(userId: string, id: string): Promise<void>;
}

export function mergePage(
  records: PulledRecord[],
  books: PulledBook[],
  since: number,
  limit: number,
): PullPage {
  const merged = [
    ...records.map((record) => ({ seq: record.seq, record })),
    ...books.map((book) => ({ seq: book.seq, book })),
  ].sort((a, b) => a.seq - b.seq);
  const page = merged.slice(0, limit);
  const last = page.at(-1);
  return {
    records: page.flatMap((item) => ("record" in item ? [item.record] : [])),
    books: page.flatMap((item) => ("book" in item ? [item.book] : [])),
    cursor: last?.seq ?? since,
    more: merged.length > limit,
  };
}

interface RecordRow {
  kind: RecordKind;
  key: string;
  payload: unknown;
  updated_at: string | number;
  deleted: boolean;
  seq: string | number;
}

interface BookRow {
  id: string;
  lang: string;
  title: string;
  added_at: string | number;
  deleted: boolean;
  bytes: number;
  seq: string | number;
}

export function createSqlSyncStore(sql: SQL): SyncStore {
  return {
    async push(userId, records) {
      return sql.begin(async (tx) => {
        await tx`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
        let accepted = 0;
        for (const record of records) {
          const payload = record.payload === null ? null : JSON.stringify(record.payload);
          const written: unknown[] =
            record.kind === "review"
              ? await tx`
                  INSERT INTO sync_record (user_id, kind, key, payload, updated_at, deleted, seq)
                  VALUES (${userId}, ${record.kind}, ${record.key}, ${payload}::text::jsonb,
                    ${record.updatedAt}, ${record.deleted}, nextval('sync_seq'))
                  ON CONFLICT (user_id, kind, key) DO NOTHING
                  RETURNING seq`
              : await tx`
                  INSERT INTO sync_record (user_id, kind, key, payload, updated_at, deleted, seq)
                  VALUES (${userId}, ${record.kind}, ${record.key}, ${payload}::text::jsonb,
                    ${record.updatedAt}, ${record.deleted}, nextval('sync_seq'))
                  ON CONFLICT (user_id, kind, key) DO UPDATE
                    SET payload = EXCLUDED.payload, updated_at = EXCLUDED.updated_at,
                        deleted = EXCLUDED.deleted, seq = EXCLUDED.seq
                    WHERE sync_record.updated_at < EXCLUDED.updated_at
                  RETURNING seq`;
          accepted += written.length;
        }
        const top: { seq: string | number }[] = await tx`
          SELECT GREATEST(
            (SELECT COALESCE(MAX(seq), 0) FROM sync_record WHERE user_id = ${userId}),
            (SELECT COALESCE(MAX(seq), 0) FROM book_blob WHERE user_id = ${userId})
          ) AS seq`;
        return { accepted, cursor: Number(top[0]?.seq ?? 0) };
      });
    },

    async pull(userId, since, limit) {
      const records: RecordRow[] = await sql`
        SELECT kind, key, payload, updated_at, deleted, seq FROM sync_record
        WHERE user_id = ${userId} AND seq > ${since} ORDER BY seq LIMIT ${limit + 1}`;
      const books: BookRow[] = await sql`
        SELECT id, lang, title, added_at, deleted, bytes, seq FROM book_blob
        WHERE user_id = ${userId} AND seq > ${since} ORDER BY seq LIMIT ${limit + 1}`;
      return mergePage(
        records.map((row) => ({
          kind: row.kind,
          key: row.key,
          payload: row.payload,
          updatedAt: Number(row.updated_at),
          deleted: row.deleted,
          seq: Number(row.seq),
        })),
        books.map((row) => ({
          id: row.id,
          lang: row.lang,
          title: row.title,
          addedAt: Number(row.added_at),
          seq: Number(row.seq),
          deleted: row.deleted,
          bytes: row.bytes,
        })),
        since,
        limit,
      );
    },

    async putBook(userId, book) {
      return sql.begin(async (tx) => {
        await tx`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
        const usage: { count: number; total: string | number }[] = await tx`
          SELECT count(*)::int AS count, COALESCE(sum(bytes), 0) AS total FROM book_blob
          WHERE user_id = ${userId} AND NOT deleted AND id <> ${book.id}`;
        const count = usage[0]?.count ?? 0;
        const total = Number(usage[0]?.total ?? 0);
        if (count + 1 > MAX_BOOKS_PER_USER || total + book.data.length > MAX_BOOK_BYTES_PER_USER) {
          return "quota_exceeded";
        }
        await tx`
          INSERT INTO book_blob (user_id, id, lang, title, added_at, deleted, data, bytes, seq)
          VALUES (${userId}, ${book.id}, ${book.lang}, ${book.title}, ${book.addedAt}, false,
            ${book.data}, ${book.data.length}, nextval('sync_seq'))
          ON CONFLICT (user_id, id) DO UPDATE
            SET lang = EXCLUDED.lang, title = EXCLUDED.title, added_at = EXCLUDED.added_at,
                deleted = false, data = EXCLUDED.data, bytes = EXCLUDED.bytes, seq = EXCLUDED.seq`;
        return "stored";
      });
    },

    async getBook(userId, id) {
      const rows: { data: Uint8Array | null }[] = await sql`
        SELECT data FROM book_blob WHERE user_id = ${userId} AND id = ${id} AND NOT deleted`;
      const data = rows[0]?.data;
      return data ? new Uint8Array(data) : undefined;
    },

    async deleteBook(userId, id) {
      await sql.begin(async (tx) => {
        await tx`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
        await tx`
          INSERT INTO book_blob (user_id, id, lang, title, added_at, deleted, data, bytes, seq)
          VALUES (${userId}, ${id}, 'es', '', 0, true, NULL, 0, nextval('sync_seq'))
          ON CONFLICT (user_id, id) DO UPDATE
            SET deleted = true, data = NULL, bytes = 0, seq = EXCLUDED.seq`;
      });
    },
  };
}
