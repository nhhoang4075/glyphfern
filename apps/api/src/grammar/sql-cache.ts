import type { SQL } from "bun";
import type { GrammarCache } from "./grammar-service";

export function createGrammarSqlCache(sql: SQL): GrammarCache {
  return {
    async get(hash) {
      const rows: { notes: string }[] = await sql`
        SELECT notes FROM grammar_note WHERE hash = ${hash}`;
      const stored = rows[0]?.notes;
      return stored === undefined ? undefined : (JSON.parse(stored) as string[]);
    },
    async put(hash, notes) {
      await sql`
        INSERT INTO grammar_note (hash, notes) VALUES (${hash}, ${JSON.stringify(notes)})
        ON CONFLICT DO NOTHING`;
    },
  };
}
