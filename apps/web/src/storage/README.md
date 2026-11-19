# Storage

Purpose: the `Repository` port and its two adapters, `DexieRepository` (IndexedDB) and `MemoryRepository` (session-only fallback). Both satisfy the same tests. Both also keep the sync outbox described below.

## Contracts

- A stored card keeps its position in the card order when it is saved again, for example after a rating. `Card.schedule` is stored with the card; a card stored without one loads without one.
- The review log is append-only. `appendReview(lang, entry)` only inserts; no method updates or deletes log entries, and `deleteCard` and `deleteBook` leave them alone.
- `loadReviewLog(lang)` returns the entries of one language ordered by `reviewedAt`, ties in append order.
- `countNewReviewsSince(lang, since)` counts entries of that language with `reviewedAt >= since` whose `before` is `null` or has `reps === 0`: the first review of a card, so a card rated again inside one session counts once.

## Outbox and sync state

- Every write method appends its outbox entry (`../sync/records.ts`) in the same Dexie transaction as the table write: `saveWordState` (a word becoming `new` is a tombstone), `saveCard`, `deleteCard` (tombstone), `appendReview`, `saveBookmarks`, `savePins`, `saveBook` and `deleteBook` (kind `book`). `savePreferences` compares with the stored preferences and appends `preferences` only when a synced field changed and one `position` entry per changed or removed book position. The memory adapter does the same.
- Entry timestamps are strictly increasing within a repository (`createStamper`); the constructor takes an optional clock for tests.
- `subscribeOutbox` notifies after each write so the sync layer can debounce a run.
- `applyRemote`, `applyRemoteBook` and `removeRemoteBook` write pulled data without touching the outbox. `applyRemote` skips a record when a newer entry for the same key is pending, drops older pending entries otherwise, and returns true only when stored data changed.
- `exportLocal` returns every local record for the first-sign-in snapshot. `loadSyncState` and `saveSyncState` hold the cursor, last sync time, uploaded book ids and the email the snapshot was taken for.
- `loadBooks` orders books by `addedAt`, then `seq`; `seq` is a random slot and says nothing about order.

## Dexie schema

Versions 1 and 2 are never edited. Version 3 adds the `reviewLog` table (`++id, lang, reviewedAt, [lang+reviewedAt]`); a database at version 2 opens with all its data and an empty log. Version 4 adds `outbox` (`++id, kind, key, [kind+key], updatedAt`) and `syncState`; a database at version 3 opens with all its data, an empty outbox and an empty sync state.

## Testing

`apps/web/test/storage/repository.test.ts` runs the card and review log tests through both adapters. `dexie-migration.test.ts` builds real version 2 and version 3 databases and opens them with the current schema. `outbox.test.ts` checks the outbox for every write and the remote apply rules on both adapters.
