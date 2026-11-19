import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { createSqlAuthStore } from "../../src/auth/auth-store";
import { migrate } from "../../src/db";
import { SCHEMA_SQL } from "../../src/schema";
import { createSqlSyncStore } from "../../src/sync/sync-store";
import { describeSyncStore, position } from "./store-contract";

const name = `glyphfern_test_sync_${Math.random().toString(36).slice(2, 8)}`;
const admin = process.env.TEST_ADMIN_DATABASE_URL ?? "postgres://localhost:5432/postgres";
let sql: SQL | undefined;
let available = true;
let counter = 0;

beforeAll(async () => {
  try {
    const adminSql = new SQL(admin);
    await adminSql.unsafe(`CREATE DATABASE ${name}`);
    await adminSql.close();
    sql = new SQL(admin.replace(/\/[^/]*$/, `/${name}`));
    await migrate(sql);
  } catch {
    available = false;
  }
});

afterAll(async () => {
  if (!available) {
    return;
  }
  await sql?.close();
  const adminSql = new SQL(admin);
  await adminSql.unsafe(`DROP DATABASE IF EXISTS ${name}`);
  await adminSql.close();
});

describeSyncStore("Postgres sync store", async () => {
  if (!available || !sql) {
    return undefined;
  }
  const database = sql;
  const auth = createSqlAuthStore(database);
  return {
    store: createSqlSyncStore(database),
    newUser: async () => {
      counter += 1;
      const user = await auth.upsertUser({
        sub: `sub-${counter}`,
        email: `user${counter}@example.com`,
        name: null,
        picture: null,
      });
      return user.id;
    },
  };
});

describe("Postgres schema and sessions", () => {
  test("migrating twice is harmless and seq is shared by records and books", async () => {
    if (!available || !sql) {
      return;
    }
    await migrate(sql);
    await sql.unsafe(SCHEMA_SQL);
    const auth = createSqlAuthStore(sql);
    const store = createSqlSyncStore(sql);
    const user = await auth.upsertUser({
      sub: "seq-user",
      email: "seq@example.com",
      name: "Seq",
      picture: null,
    });
    await store.push(user.id, [position("a", 1, 1)]);
    await store.putBook(user.id, {
      id: "b",
      lang: "es",
      title: "t",
      addedAt: 1,
      data: Bun.gzipSync(new Uint8Array([1])),
    });
    await store.push(user.id, [position("c", 1, 1)]);
    const page = await store.pull(user.id, 0, 500);
    const seqs = [...page.records.map((r) => r.seq), ...page.books.map((b) => b.seq)].sort(
      (a, b) => a - b,
    );
    expect(new Set(seqs).size).toBe(3);
    expect(page.cursor).toBe(seqs[2] as number);
  });

  test("sessions are found by hash until they expire and can be deleted", async () => {
    if (!available || !sql) {
      return;
    }
    const auth = createSqlAuthStore(sql);
    const user = await auth.upsertUser({
      sub: "session-user",
      email: "session@example.com",
      name: null,
      picture: null,
    });
    await auth.createSession(user.id, "hash-1", 2000, 1000);
    expect((await auth.findSession("hash-1", 1500))?.user.email).toBe("session@example.com");
    expect(await auth.findSession("hash-1", 2000)).toBeUndefined();
    await auth.extendSession("hash-1", 9000);
    expect((await auth.findSession("hash-1", 5000))?.expiresAt).toBe(9000);
    await auth.deleteSession("hash-1");
    expect(await auth.findSession("hash-1", 1500)).toBeUndefined();
  });
});
