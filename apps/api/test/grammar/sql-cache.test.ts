import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { migrate } from "../../src/db";
import { createGrammarSqlCache } from "../../src/grammar/sql-cache";

const name = `glyphfern_test_grammar_${Math.random().toString(36).slice(2, 8)}`;
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

describe("grammar sql cache", () => {
  test("stores notes and reads them back", async () => {
    if (!available || !sql) {
      return;
    }
    const cache = createGrammarSqlCache(sql);
    expect(await cache.get("h1")).toBeUndefined();
    await cache.put("h1", ["một", "hai"]);
    await cache.put("h1", ["khác"]);
    expect(await cache.get("h1")).toEqual(["một", "hai"]);
  });
});
