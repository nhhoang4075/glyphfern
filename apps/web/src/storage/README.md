# Storage

Purpose: the `Repository` port and its two adapters, `DexieRepository` (IndexedDB) and `MemoryRepository` (session-only fallback). Both satisfy the same tests.

## Contracts

- A stored card keeps its position in the card order when it is saved again, for example after a rating. `Card.schedule` is stored with the card; a card stored without one loads without one.
- The review log is append-only. `appendReview(lang, entry)` only inserts; no method updates or deletes log entries, and `deleteCard` and `deleteBook` leave them alone.
- `loadReviewLog(lang)` returns the entries of one language ordered by `reviewedAt`, ties in append order.
- `countNewReviewsSince(lang, since)` counts entries of that language with `reviewedAt >= since` whose `before` is `null` or has `reps === 0`: the first review of a card, so a card rated again inside one session counts once.

## Dexie schema

Versions 1 and 2 are never edited. Version 3 adds the `reviewLog` table (`++id, lang, reviewedAt, [lang+reviewedAt]`); a database at version 2 opens with all its data and an empty log.

## Testing

`apps/web/test/storage/repository.test.ts` runs the card and review log tests through both adapters. `dexie-migration.test.ts` builds a real version 2 database and opens it with the current schema.
