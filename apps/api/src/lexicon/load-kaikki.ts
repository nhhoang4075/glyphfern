import type { SQL } from "bun";
import { readConfig } from "../config";
import { connect, migrate } from "../db";
import { type LexiconRow, parseKaikkiLine } from "./parse-kaikki";

const BATCH_SIZE = 2000;

export async function* readLines(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (value) {
      buffer += decoder.decode(value, { stream: true });
      let newline = buffer.indexOf("\n");
      while (newline !== -1) {
        yield buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf("\n");
      }
    }
    if (done) {
      break;
    }
  }
  if (buffer.length > 0) {
    yield buffer;
  }
}

async function insertBatch(sql: SQL, lang: string, rows: LexiconRow[]): Promise<void> {
  if (rows.length === 0) {
    return;
  }
  const records = rows.map((row) => ({
    lang,
    word: row.word,
    pos: row.pos,
    ipa: row.ipa,
    glosses: JSON.stringify(row.glosses),
    lemma: row.lemma,
  }));
  await sql`INSERT INTO lex_entry ${sql(records)}`;
}

export async function loadKaikki(
  sql: SQL,
  lang: string,
  stream: ReadableStream<Uint8Array>,
): Promise<number> {
  await migrate(sql);
  await sql`DELETE FROM lex_entry WHERE lang = ${lang}`;
  let batch: LexiconRow[] = [];
  let total = 0;
  for await (const line of readLines(stream)) {
    const row = parseKaikkiLine(line, lang);
    if (!row) {
      continue;
    }
    batch.push(row);
    if (batch.length >= BATCH_SIZE) {
      await insertBatch(sql, lang, batch);
      total += batch.length;
      batch = [];
    }
  }
  await insertBatch(sql, lang, batch);
  return total + batch.length;
}

if (import.meta.main) {
  const [path, lang = "es"] = process.argv.slice(2);
  if (!path) {
    console.error("usage: bun run load-lexicon <kaikki.jsonl> [lang]");
    process.exit(1);
  }
  const sql = connect(readConfig().databaseUrl);
  const count = await loadKaikki(sql, lang, Bun.file(path).stream());
  await sql.close();
  console.log(`loaded ${count} entries for ${lang}`);
}
