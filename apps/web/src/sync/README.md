# Sync

Purpose: optional Google sign-in and multi-device sync (`spec/sync.md`). Signed out, the app is purely local; this folder only adds upload and download. Storage always writes the outbox, signed in or not.

## Flow

`AccountController` (`account.ts`) is the single entry point, created in `main.tsx` and exposed to React through `SyncProvider` and `useAccount()`.

1. `start()` fetches `GET /auth/config` from `VITE_API_URL` (no base url: sign-in is unavailable and nothing is fetched). `googleClientId` stays `null` when the config is missing or unreachable, and the account row renders nothing.
2. A session in `localStorage` (`glyphfern.session`, `session.ts`, every access wrapped in try/catch) is validated with `GET /auth/me`. 401 clears it; a network failure keeps it.
3. `google-identity.ts` loads `https://accounts.google.com/gsi/client` only when the account row shows the sign-in button. If the script fails to load the button stays hidden. The credential goes to `POST /auth/google`.
4. With a session, `beginSession` creates a `SyncRunner` and subscribes to the repository outbox. Triggers: sign-in, app start, 2 s after the last outbox write (debounced), tab becoming visible, `online`.
5. `SyncRunner` (`runner.ts`) runs one `syncOnce` at a time; triggers during a run coalesce into exactly one more run. Status is `syncing`, `synced` or `failed`; a 401 clears the session; after a run that changed local data it calls `store.actions.reload()`.
6. `syncOnce` (`engine.ts`): enqueue the snapshot once per signed-in email, push the outbox, upload or delete books, pull until `more` is false storing the cursor, then download new books and delete locally the ones with a tombstone.
7. Sign-out calls `POST /auth/logout` and clears the session; local data stays.

## Contracts

- `records.ts` builds outbox records from repository writes and decodes pulled records into `RemoteChange` values that both repositories apply. Record kinds and keys follow `spec/sync.md` section 2. `book` is an extra local-only outbox kind that never goes to `/sync/push`: a put means "upload this book", a tombstone means "`DELETE /books/<id>`".
- `merge.ts`: `mergeRecord` is last write wins on `updatedAt`, a tie goes to the remote (server) copy, a review is first write wins. `latestPerKey` collapses the outbox to the newest entry per kind and key before pushing.
- A pulled record is ignored when the outbox holds a newer pending entry for the same key; otherwise it is applied and the older pending entries of that key are dropped. Applying reports a change only when stored data really differs, so the echo of our own push does not reload the UI.
- Timestamps come from `createStamper`: the clock, forced to be strictly increasing within the repository, so two writes in one millisecond never tie.
- `snapshot.ts`: records that exist locally from before the outbox (or signed-out use) are enqueued with `updatedAt = 1` (reviews keep `reviewedAt`), so on a conflict the server copy wins and a record the server lacks is accepted.
- Uploaded books are the whole `StoredBook` JSON, gzip-compressed with `fflate` (`gzip.ts`), so the slot (`seq`), sentence ids and lemmas are identical on every device. `PUT /books/<id>?lang&title&addedAt`. `syncState.bookUploaded` lists ids known to be on the server.
- `http.ts` is the only code that calls `fetch` for sync; tests replace it with the in-memory server in `apps/web/test/sync/fake-server.ts`.
- `expiresAt` is stored as returned and never interpreted on the client; the server's 401 is the only expiry signal.

## Failure modes

- Any network or server error sets status `failed` ("Chưa đồng bộ được") and leaves the outbox untouched; the next trigger retries. A book upload failure does not stop records from being pulled.
- A push answered with 400 is retried record by record; a record the server still rejects is dropped from the outbox so it cannot block later pushes.
- A book whose download fails or is not valid gzip JSON is skipped and retried on the next run.
- The sign-in button shows a Vietnamese message for 403 (email not allowed), 401 (bad credential) and unreachable server; no native dialog is ever opened.

## Testing

`apps/web/test/sync/pure.test.ts` covers merge, outbox records, snapshot, batching and the book plan. `convergence.test.ts` runs two offline devices against the fake server on both storage adapters. `account.test.ts` covers sign-in, session validation, sign-out, debounced runs and the runner. Real Google sign-in and the real server are not covered by tests.
