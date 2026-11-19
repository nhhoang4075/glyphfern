import type { SQL } from "bun";
import type { FormRow, LemmaStore } from "./lemmas";
import type { LexiconStore, StoredEntry } from "./lookup";

interface Row {
  word: string;
  pos: string;
  ipa: string | null;
  glosses: string;
  lemma: string | null;
}

export function createSqlStore(sql: SQL): LexiconStore & LemmaStore {
  return {
    async findByWord(lang, word): Promise<StoredEntry[]> {
      const rows: Row[] = await sql`
        SELECT word, pos, ipa, glosses, lemma
        FROM lex_entry
        WHERE lang = ${lang} AND lower(word) = ${word}
        ORDER BY id
        LIMIT 40`;
      return rows.map((row) => ({ ...row, glosses: JSON.parse(row.glosses) as string[] }));
    },

    async findForms(lang, words): Promise<FormRow[]> {
      if (words.length === 0) {
        return [];
      }
      return sql`
        SELECT lower(word) AS word, lemma
        FROM lex_entry
        WHERE lang = ${lang} AND lower(word) IN ${sql(words)}`;
    },
  };
}
