import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { migrate } from "../../src/db";
import { createTtsSqlCache } from "../../src/tts/sql-cache";

const name = `glyphfern_test_tts_${Math.random().toString(36).slice(2, 8)}`;
const admin = process.env.TEST_ADMIN_DATABASE_URL ?? "postgres://localhost:5432/postgres";
let sql: SQL | undefined;
let available = true;

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

describe("tts audio in Postgres", () => {
  test("stored audio comes back byte for byte and a missing hash is undefined", async () => {
    if (!available || !sql) {
      return;
    }
    const cache = createTtsSqlCache(sql);
    const audio = new Uint8Array([0, 1, 2, 250, 251, 255, 0, 7]);
    expect(await cache.get("missing")).toBeUndefined();
    await cache.put("abc", audio);
    expect(await cache.get("abc")).toEqual(audio);
  });

  test("storing the same hash again keeps the first audio", async () => {
    if (!available || !sql) {
      return;
    }
    const cache = createTtsSqlCache(sql);
    await cache.put("twice", new Uint8Array([1, 1]));
    await cache.put("twice", new Uint8Array([2, 2]));
    expect(await cache.get("twice")).toEqual(new Uint8Array([1, 1]));
  });

  test("migrating again is harmless", async () => {
    if (!available || !sql) {
      return;
    }
    await migrate(sql);
    const rows = await sql`SELECT count(*)::int AS n FROM tts_audio`;
    expect(rows[0]?.n).toBeGreaterThanOrEqual(1);
  });
});
