# API

Purpose: a small Bun HTTP service that answers lexicon lookups and bulk lemma requests from Postgres and translates short texts through a pluggable translator with a shared cache.

## Endpoints

- `GET /health`.
- `GET /lookup?lang=es&word=...`: entries (lemma, part of speech, IPA, English glosses). Proper nouns are listed last.
- `POST /lemmas` `{ lang, words }`: map of inflected form to lemma. Words that have their own dictionary entry are not remapped. Body at most 512 KB, 5000 words.
- `POST /translate` `{ from, to, texts }`: pairs `es:vi`, `es:en`, `en:vi`; at most 20 texts of 500 characters. Answers 503 when no translator is configured, 429 when the daily character budget is used up, 502 when the provider fails.

## Translation flow

1. Each text is hashed (SHA-256). A cache hit in the `translation` table is returned without a provider call.
2. A miss consumes its length from the daily budget (in memory, resets at 00:00 UTC, per process), then calls the `Translator`.
3. The result is stored in the cache. Translators are replaceable: implement `Translator` in `src/translate`.

## Configuration

| Variable | Meaning | Default |
| --- | --- | --- |
| `DATABASE_URL` | Postgres connection | `postgres://localhost:5432/glyphfern` |
| `PORT` | HTTP port | `8787` |
| `ALLOWED_ORIGIN` | CORS origin of the web app | `http://localhost:5183` |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` | enable the Cloudflare Workers AI translator (`@cf/meta/m2m100-1.2b`) | unset (translation disabled) |
| `TRANSLATE_DAILY_CHAR_LIMIT` | characters of provider calls per day | `100000` |

Secrets live in `apps/api/.env` or the host's variables, never in the repository.

## Loading the dictionary

`bun run migrate` creates the tables. `bun run load-lexicon <kaikki.jsonl> es` replaces all entries of that language from a kaikki.org Wiktionary extract (about 1.1 GB for Spanish, loads in seconds).

## Testing

`bun test apps/api`. The Postgres test creates and drops its own database on `localhost`; it is skipped when Postgres is unreachable.
