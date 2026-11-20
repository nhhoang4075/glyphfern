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
ALTER TABLE lex_entry ADD COLUMN IF NOT EXISTS facts TEXT;
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
CREATE TABLE IF NOT EXISTS tts_audio (
  hash TEXT PRIMARY KEY,
  audio BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS grammar_note (
  hash TEXT PRIMARY KEY,
  notes TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS app_user (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  picture TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS session (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at BIGINT NOT NULL
);
CREATE SEQUENCE IF NOT EXISTS sync_seq;
CREATE TABLE IF NOT EXISTS sync_record (
  user_id UUID NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  key TEXT NOT NULL,
  payload JSONB,
  updated_at BIGINT NOT NULL,
  deleted BOOLEAN NOT NULL,
  seq BIGINT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS sync_record_identity ON sync_record (user_id, kind, key);
CREATE INDEX IF NOT EXISTS sync_record_seq ON sync_record (user_id, seq);
CREATE TABLE IF NOT EXISTS book_blob (
  user_id UUID NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  lang TEXT NOT NULL,
  title TEXT NOT NULL,
  added_at BIGINT NOT NULL,
  deleted BOOLEAN NOT NULL,
  data BYTEA,
  bytes INTEGER NOT NULL,
  seq BIGINT NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS book_blob_seq ON book_blob (user_id, seq);
`;
