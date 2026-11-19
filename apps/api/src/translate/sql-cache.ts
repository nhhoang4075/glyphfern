import type { SQL } from "bun";
import type { TranslationCache } from "./translate-service";

export function createSqlCache(sql: SQL): TranslationCache {
  return {
    async get(source, target, hash) {
      const rows: { translated_text: string }[] = await sql`
        SELECT translated_text FROM translation
        WHERE source_lang = ${source} AND target_lang = ${target} AND text_hash = ${hash}`;
      return rows[0]?.translated_text;
    },
    async put(source, target, hash, text, translated, provider) {
      await sql`
        INSERT INTO translation (source_lang, target_lang, text_hash, source_text, translated_text, provider)
        VALUES (${source}, ${target}, ${hash}, ${text}, ${translated}, ${provider})
        ON CONFLICT DO NOTHING`;
    },
  };
}
