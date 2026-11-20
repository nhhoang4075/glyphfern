# Accounts and sync

Scope: owner-only Google sign-in and multi-device sync for `apps/api` and `apps/web`. The app stays local-first: signed out it behaves exactly as before; signing in only adds upload and download. Decisions: D-025.

## 1. Authentication

- Sign-in uses Google Identity Services in the browser. The browser sends the Google ID token (a JWT) to the API; the API needs only the public client id, never a client secret.
- `GET /auth/config` returns `{ "googleClientId": string | null }`. `null` means sign-in is not configured and the web hides the sign-in button.
- `POST /auth/google` with body `{ "credential": string }`. The API MUST verify: RS256 signature against Google's published keys (`https://www.googleapis.com/oauth2/v3/certs`, cached with the response's max-age), `iss` is `https://accounts.google.com` or `accounts.google.com`, `aud` equals `GOOGLE_CLIENT_ID`, `exp` is in the future, `email_verified` is true, and the lowercase `email` is in `ALLOWED_EMAILS` (comma-separated, lowercase). Any failure answers 401 `{ "error": "invalid_credential" }`; a verified email outside the list answers 403 `{ "error": "not_allowed" }`.
- On success the API upserts the user by Google `sub` and returns `{ "token": string, "expiresAt": number, "user": { "email": string, "name": string | null, "picture": string | null } }`. The token is 32 random bytes, base64url. Only its SHA-256 is stored. Lifetime 90 days; `GET /auth/me` extends it by touching `expires_at` when under 30 days remain.
- `GET /auth/me` returns `{ "user": … }`. `POST /auth/logout` deletes the session row and answers 204.
- Every `/sync/*` and `/books/*` route requires `Authorization: Bearer <token>`; a missing, unknown or expired token answers 401 `{ "error": "unauthorized" }`. The existing public routes (`/lookup`, `/lemmas`, `/translate`, `/tts`, `/health`) are unchanged.
- Tables: `app_user(id uuid pk, google_sub text unique, email text unique, name text, picture text, created_at)` and `session(token_hash text pk, user_id uuid references app_user, created_at, expires_at)`.
- Config: `GOOGLE_CLIENT_ID`, `ALLOWED_EMAILS`. When `GOOGLE_CLIENT_ID` is unset the auth and sync routes answer 503 `{ "error": "auth_not_configured" }`.

## 2. Synced records

All user data is stored as records in `sync_record(user_id, kind, key, payload jsonb, updated_at bigint, deleted boolean, seq bigint)` with a unique index on `(user_id, kind, key)`. `seq` comes from one global `BIGSERIAL`-style sequence and is reassigned on every accepted write. `updated_at` is the client clock in milliseconds.

| kind | key | payload | merge |
| --- | --- | --- | --- |
| `wordState` | `<lang>:<lemma>` | the `WordState` | last write wins |
| `card` | `<lang>:<lemma>` | `{ lemma, sentenceId, schedule? }` | last write wins |
| `review` | `<lang>:<reviewedAt>:<lemma>` | the `ReviewLogEntry` plus `lang` | append-only, first write wins, never deleted |
| `bookmarks` | `<lang>` | `{ sentenceIds: number[] }` | last write wins |
| `pins` | `all` | `{ bookIds: string[] }` | last write wins |
| `preferences` | `main` | `size, lh, font, paper, turn, hl, voice` | last write wins |
| `position` | `<bookId>` | `{ sentenceId: number }` | last write wins |

- Last write wins compares `updated_at`; on a tie the record with the larger `seq` (the server's copy) wins. A push whose `updated_at` is not newer than the stored one is ignored for that record and the stored one is returned on the next pull.
- Deletions are tombstones: `deleted = true`, payload `null`.
- Not synced: `lang`, `bookId` of the open book, and coverage (recomputed locally).
- `POST /sync/push` body `{ "records": [{ "kind", "key", "payload", "updatedAt", "deleted" }] }`, at most 500 records and 1 MB. Answers `{ "accepted": number, "cursor": number }`. Invalid kinds or keys answer 400 `{ "error": "invalid_record" }` and nothing is written.
- `GET /sync/pull?since=<seq>&limit=<n>` answers `{ "records": [{ "kind", "key", "payload", "updatedAt", "deleted", "seq" }], "books": [{ "id", "lang", "title", "addedAt", "seq", "deleted", "bytes" }], "cursor": number, "more": boolean }`, ordered by `seq`, `limit` default and maximum 500. The client repeats while `more` is true and stores `cursor`. Records and book metadata share the same `seq` sequence.

## 3. Synced books

- A built book (the `StoredBook` JSON: chapters, sentences, tokens, lemmas) is uploaded gzip-compressed so sentence ids and lemmas are identical on every device. The source EPUB is not uploaded.
- Table `book_blob(user_id, id text, lang, title, added_at bigint, deleted boolean, data bytea, bytes int, seq bigint, primary key (user_id, id))`.
- `PUT /books/<id>` with `Content-Type: application/gzip`, body at most 32 MB, answers 204. `GET /books/<id>` answers the gzip bytes (`Content-Type: application/gzip`) or 404. `DELETE /books/<id>` writes a tombstone (clears `data`) and answers 204. Each write assigns a new `seq`.
- A user may hold at most 50 books and 200 MB of book data; beyond that PUT answers 413 `{ "error": "quota_exceeded" }`.
- `apps/web/serve.ts` raises its request body cap to 32 MB for `PUT /api/books/*` only; all other routes keep 512 KB.

## 4. Sentence id ranges

A book's sentences are numbered from `slot * 1_000_000` where `slot` is the book's `seq` in storage. A slot is chosen at random in `[1000, 2^30)` and re-drawn while any stored book already uses it, so two devices that import different books offline do not collide. Existing slots below 1000 stay valid.

## 5. Client behaviour

- Local storage gains an `outbox` table (`++id, kind, key, payload, updatedAt, deleted`) and a `syncState` table (`cursor`, `lastSyncedAt`, `bookUploaded` ids). Every local write also appends to the outbox, signed in or not, so the first sign-in uploads everything: on sign-in the client also enqueues a full snapshot of local records and uploads every local book not yet on the server.
- Sync runs on sign-in, on app start, 2 seconds after the last local change, when the tab becomes visible and when the browser comes back online. Order: push the outbox, then pull until `more` is false, then fetch any book whose metadata is new or newer and not stored locally (and delete locally the books whose tombstone is newer than the local copy).
- Applying a pulled record uses the same last-write-wins rule; the in-memory store is refreshed after each pull that changed something.
- The token is kept in `localStorage` under `glyphfern.session`. A 401 clears it and shows the signed-out state; local data is never deleted by signing out.
- Signing in as a different account than the one the local data was last synced for never uploads that local data: the outbox is cleared, the cursor resets and no snapshot is taken.
- A session whose email is no longer in `ALLOWED_EMAILS` is deleted and answers 401. `POST /auth/google` reads its body only when `Content-Length` is present and at most 16 KB.
- Sign-in is required to use the app (D-031): see §6.1. Local data is still kept on the device and uploaded on sign-in.

## 6. Interface

- The library screen shows an account row above the shelf: signed out, the Google sign-in button (hidden when `/auth/config` returns `null`); signed in, the avatar, the email, a status text ("Đã đồng bộ", "Đang đồng bộ…", "Chưa đồng bộ được") and a "Đăng xuất" button.
- Sign-out and failures never open a native dialog.

## 6.1 Sign-in gate (D-031)

- On start the app reads the stored session (`glyphfern.session`). With a stored session it opens at once, offline included; the session is checked in the background with `GET /auth/me`, and only a 401 sends the user back to the gate. A network error never closes the app.
- Without a stored session the app shows the gate instead of any screen: the fern mark, one line of text, the Google sign-in button, and the error text for `not_allowed` or a failed sign-in. No library, reader, review or word list is reachable behind it.
- The gate asks `GET /auth/config` first. When it answers `{ googleClientId: null }` (a server without auth, development) the gate is skipped and the app is open as before. When the request fails and there is no stored session, the gate shows a short "needs a connection to sign in the first time" text with a retry button.
- Signing out returns to the gate. Local data is not deleted by sign-out (rule in §5 stays).
- `GET /lexicon`, `GET /lemmas` and `GET /tts` stay open; the gate is a client rule, the data itself is local.
- The gate follows the night theme and reuses the Google button of the account row, which moves to the gate and to the account menu once signed in.

## 7. Tests

- API: token verification with a locally generated RSA key and a fake key fetcher (valid, bad signature, wrong `aud`, wrong `iss`, expired, unverified email, email not allowed), session lifecycle, last-write-wins and tie-break, review append-only, tombstones, `since` paging, quota, 401 on every protected route.
- Web: merge and outbox logic as pure functions; two fake devices edit offline, sync, and converge; slot allocation never reuses a taken slot.
