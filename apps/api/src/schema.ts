export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS lex_entry (
  id BIGSERIAL PRIMARY KEY,
  lang TEXT NOT NULL,
  word TEXT NOT NULL,
  pos TEXT NOT NULL,
  ipa TEXT,
  glosses TEXT NOT NULL,
  lemma TEXT
);
CREATE INDEX IF NOT EXISTS lex_entry_lookup ON lex_entry (lang, lower(word));
CREATE TABLE IF NOT EXISTS translation (
  source_lang TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  text_hash TEXT NOT NULL,
  source_text TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  provider TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (source_lang, target_lang, text_hash)
);
`;
