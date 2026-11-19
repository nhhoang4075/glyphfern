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
`;
