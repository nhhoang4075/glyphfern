import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { migrate } from "../../src/db";
import { loadKaikki } from "../../src/lexicon/load-kaikki";
import { lookupWord } from "../../src/lexicon/lookup";
import { createSqlStore } from "../../src/lexicon/sql-store";
import { KAIKKI_LINES } from "./fixture";

const name = `glyphfern_test_api_${Math.random().toString(36).slice(2, 8)}`;
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

function streamOf(lines: string[]): ReadableStream<Uint8Array> {
  return new Response(lines.join("\n")).body as ReadableStream<Uint8Array>;
}

describe("lexicon in Postgres", () => {
  test("loading the fixture stores es entries and lookup resolves forms", async () => {
    if (!available || !sql) {
      return;
    }
    const count = await loadKaikki(sql, "es", streamOf(KAIKKI_LINES));
    expect(count).toBe(5);
    const result = await lookupWord(createSqlStore(sql), "es", "miraba");
    expect(result?.lemma).toBe("mirar");
    expect(result?.entries[0]?.glosses).toEqual(["to look at", "to watch"]);
  });

  test("loading again replaces the previous entries of that language", async () => {
    if (!available || !sql) {
      return;
    }
    await loadKaikki(sql, "es", streamOf(KAIKKI_LINES));
    const rows = await sql`SELECT count(*)::int AS n FROM lex_entry WHERE lang = 'es'`;
    expect(rows[0]?.n).toBe(5);
  });
});
