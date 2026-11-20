# API

Purpose: a small Bun HTTP service that answers lexicon lookups and bulk lemma requests from Postgres, translates short texts through a pluggable translator with a shared cache, and reads short texts aloud through the Kokoro sidecar (`apps/tts`) with a shared audio cache.

## Endpoints

- `GET /health`.
- `GET /lookup?lang=es&word=...`: entries (lemma, part of speech, IPA, English glosses, `facts`). Proper nouns are listed last.
- `POST /lemmas` `{ lang, words }`: `{ lemmas, unknown }`. `lemmas` maps inflected form to lemma; words that have their own dictionary entry are not remapped, and words whose lemma is themselves are absent. `unknown` lists the lowercase words with no row in the forms table (a row of any kind counts as known). Body at most 512 KB, 5000 words.
- `POST /translate` `{ from, to, texts }`: pairs `es:vi`, `es:en`, `en:vi`; at most 20 texts of 500 characters. Answers 503 when no translator is configured, 429 when the daily character budget is used up, 502 when the provider fails.
- `GET /tts?lang=es&text=...&speed=0.78`: MP3 audio (`audio/mpeg`, mono, 48 kbit/s) of the text read by the Kokoro voice of that language. `lang` must be `es` (400 `unsupported_language`); `text` is trimmed and 1 to 500 characters (400 `invalid_text`); `speed` is a number from 0.5 to 1.5, default 1 (400 `invalid_speed`). Answers 503 `tts_not_configured` when `TTS_URL` is unset, 429 `rate_limited` for the client limits, 429 `budget_exceeded` when the daily character budget is used up, 502 `tts_failed` when the sidecar fails. Success carries `cache-control: public, max-age=604800` and the CORS header.

- `GET /auth/config`: `{ googleClientId }`, `null` when sign-in is not configured.
- `POST /auth/google` `{ credential }`: verifies a Google ID token and answers `{ token, expiresAt, user }`. 401 `invalid_credential`, 403 `not_allowed`.
- `GET /auth/me`: `{ user }` and extends a session with under 30 days left. `POST /auth/logout`: 204.
- `POST /sync/push` `{ records }`: at most 500 records and 1 MB; answers `{ accepted, cursor }`. 400 `invalid_record` (nothing written), 413 `payload_too_large`.
- `GET /sync/pull?since=<seq>&limit=<n>`: `{ records, books, cursor, more }` ordered by `seq`; `limit` 1 to 500, default 500; 400 `invalid_query`.
- `PUT /books/<id>?lang=es&title=<text>&addedAt=<ms>` with `Content-Type: application/gzip`: stores the gzip bytes, 204. `GET /books/<id>`: the gzip bytes or 404. `DELETE /books/<id>`: tombstone, 204. Errors: 400 `invalid_book_id`, `unsupported_language`, `invalid_title`, `invalid_added_at`, `invalid_body`; 413 `payload_too_large`, `quota_exceeded`; 415 `unsupported_media_type`.
- Every `/sync/*` and `/books/*` route needs `Authorization: Bearer <token>` (401 `unauthorized`); auth and sync routes answer 503 `auth_not_configured` when `GOOGLE_CLIENT_ID` is unset.

## Translation flow

1. Each text is hashed (SHA-256). A cache hit in the `translation` table is returned without a provider call.
2. Before any of this, the client (IP address) must be within its own per-minute request and daily character limits; limits are in memory and per process; IPv6 clients are grouped by their /64 prefix and IPv4-mapped addresses count as IPv4; IPv4 addresses embedded in IPv6 (mapped, compatible, NAT64) count as that IPv4, and only global unicast IPv6 is grouped by /64; when the client table is full only entries of a past day are evicted and further new clients share one overflow bucket with its own limits.
3. A miss consumes its length from the global daily budget (in memory, resets at 00:00 UTC, per process), then calls the `Translator`.
4. The result is stored in the cache. Translators are replaceable: implement `Translator` in `src/translate`.

## Speech flow

1. `/tts` answers 503 when no sidecar is configured, then validates `lang`, `text` and `speed`, then checks the client (the same limiter instance and limits as `/translate`: the two routes share each client's counters) with `text.length` characters. Only after that does the service run.
2. The speed is rounded to 2 decimals; `0.78` and `0.780` are the same request. The cache key is the SHA-256 hex of `${voice}|${speed}|${text}`, where the voice is the configured one for the language (`TTS_VOICE_ES`).
3. A hit in the `tts_audio` table is returned without calling the sidecar and without touching the budget.
4. A miss consumes `text.length` from the global daily budget (the same in-memory, per-process, 00:00 UTC mechanism as translation, with its own counter), then calls the `Synthesizer`, then stores the audio.
5. The `Synthesizer` implemented in `src/tts/kokoro-synthesizer.ts` posts `{ text, voice, speed }` to `{TTS_URL}/synthesize` with a 30 second timeout and returns the MP3 bytes. Any network failure, timeout, non-200 reply or empty body is a `SynthesizerError`. Other engines are added by implementing `Synthesizer` in `src/tts`.

The sidecar is internal: it has no authentication and must only be reachable from this service.

## Account and sync flow

1. The browser sends a Google ID token to `POST /auth/google`. `src/auth/google-verifier.ts` verifies the RS256 signature against Google's published keys (fetched from `https://www.googleapis.com/oauth2/v3/certs` and cached for the response's `max-age`), the issuer (`https://accounts.google.com` or `accounts.google.com`), the audience (`GOOGLE_CLIENT_ID`), the expiry and `email_verified`. The key source is a `KeyFetcher`, so tests inject their own keys. Tokens are never logged.
2. A verified email must be in `ALLOWED_EMAILS` (lowercase, comma separated). The user is upserted by Google `sub`; the session token is 32 random bytes in base64url, only its SHA-256 is stored, it lives 90 days and `GET /auth/me` renews it when under 30 days remain.
3. Protected routes read the bearer token, hash it and look the hash up. A missing, malformed, unknown or expired token is 401, and every query afterwards is scoped by the session's `user_id`.
4. `POST /sync/push` validates the whole batch first (`src/sync/records.ts`: kinds, key shapes, payload shapes, size caps; `lang` must be `es`; tombstones carry a null payload; reviews cannot be deleted) and writes it in one transaction under a per-user advisory lock, so `seq` values become visible in order. A record replaces the stored one only when its `updatedAt` is greater (or the key is absent); a tie keeps the stored record; `review` rows are inserted when absent and never changed. `accepted` counts the records actually written; `cursor` is the user's highest `seq`.
5. `seq` comes from the single Postgres sequence `sync_seq`, used by `sync_record` and `book_blob`. `GET /sync/pull` reads up to `limit + 1` rows of each table after `since`, merges them by `seq`, keeps `limit` rows in total, returns the largest `seq` kept as `cursor` (the `since` value when the page is empty) and sets `more` when rows remain.
6. Books are stored as the uploaded gzip bytes in `book_blob.data` and are never decompressed on the server; the body must start with the gzip magic bytes `1f 8b`. A user holds at most 50 live books and 200 MB; replacing a book does not count it twice. Deleting clears `data` and keeps a tombstone row with a new `seq`.
7. `maxRequestBodySize` of the Bun server is 32 MB (the largest book); `/translate`, `/lemmas` and `/sync/push` check the declared `content-length` against their own caps.

## Configuration

| Variable | Meaning | Default |
| --- | --- | --- |
| `DATABASE_URL` | Postgres connection | `postgres://localhost:5432/glyphfern` |
| `PORT` | HTTP port | `8787` |
| `ALLOWED_ORIGIN` | CORS origin of the web app | `http://localhost:5183` |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` | enable the Cloudflare Workers AI translator (`@cf/meta/m2m100-1.2b`) | unset (translation disabled) |
| `TRANSLATE_DAILY_CHAR_LIMIT` | global backstop: characters of provider calls per day | `100000` |
| `CLIENT_DAILY_CHAR_LIMIT` | characters one client may send to `/translate` and `/tts` together per day | `20000` |
| `CLIENT_REQUESTS_PER_MINUTE` | `/translate` and `/tts` requests one client may make per minute | `30` |
| `TTS_URL` | base URL of the Kokoro sidecar, for example `http://127.0.0.1:8788` | unset (`/tts` answers 503) |
| `TTS_VOICE_ES` | Kokoro voice used for `lang=es` | `ef_dora` |
| `TTS_DAILY_CHAR_LIMIT` | global backstop: characters sent to the sidecar per day (cache hits are free) | `50000` |
| `GOOGLE_CLIENT_ID` | public OAuth client id of the Google sign-in; enables the auth and sync routes | unset (routes answer 503) |
| `ALLOWED_EMAILS` | comma separated emails that may sign in (case is ignored) | empty (nobody can sign in) |
| `TRUST_PROXY` | set to `1` behind a proxy (Railway) to identify clients by the last `X-Forwarded-For` entry | unset |

Secrets live in `apps/api/.env` or the host's variables, never in the repository.

## Entry facts

Each lemma entry carries `facts` (null when nothing applies), taken from the Wiktionary entry and kept in Wiktionary's own tag names; the web app words them in Vietnamese.

- `gender`, `number`, `plural`, `feminine`: for nouns, adjectives, determiners, pronouns and numerals. `number` tags (`plural-only`, `uncountable`, `invariable`) count only when every chosen sense has them.
- `senseLabels`: for each gloss, its usage and region tags (`colloquial`, `slang`, `Mexico`, ...). Index `i` belongs to `glosses[i]`.
- `alternations`, `irregular`, `unusualForms`: for verbs. `unusualForms` are the forms among yo present, yo preterite, third-person preterite, past participle and gerund that differ from the regular pattern of the infinitive; verbs whose infinitive does not end in `-ar`, `-er` or `-ir` get none.

## Loading the dictionary

`bun run migrate` creates the tables and adds missing columns. `bun run load-lexicon <kaikki.jsonl> es` replaces all entries of that language from a kaikki.org Wiktionary extract (about 1.1 GB for Spanish, loads in seconds).

## Failure modes

- Sidecar down, slow (over 30 seconds) or answering an error: `/tts` answers 502 `tts_failed` and stores nothing;
- Budget used up: new texts answer 429 `budget_exceeded`; texts already in `tts_audio` keep answering.
- Google keys unreachable or the token invalid: sign-in answers 401 `invalid_credential` and no session is created.
- A malformed record in a push batch rejects the whole batch with 400 and writes nothing.
- Process restart: the budgets and client limits reset; the cached audio stays in Postgres.

## Testing

`bun test apps/api`. The speech tests use a fake `Synthesizer` and an in-memory cache. Auth tests sign tokens with a locally generated RSA key and a fake key fetcher. Sync tests run one shared contract against an in-memory store and the Postgres store, and route tests go through `handle` with two signed-in users. The Postgres tests (lexicon, `tts_audio`, sync) create and drop their own database on `localhost`; they are skipped when Postgres is unreachable.

## Waking sidecar

`createKokoroSynthesizer` retries a request that fails with 502, 503 or 504 or with a network error every 1.5 seconds for up to 35 seconds, so the `tts` service can sleep (Serverless) and wake on the first request. Other statuses are not retried. The server idle timeout is 60 seconds so a waiting request is not cut.
