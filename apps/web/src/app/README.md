# App store

Purpose: the single source of app state for `apps/web`. Screens read it through `useApp()` and change it only through its actions. Every word state transition is delegated to `@glyphfern/core`; nothing in this folder reimplements a transition.

## Contracts

`api.ts` is the public interface. `useApp()` returns `AppApi`:

```
const { state, actions, stateOf } = useApp();
```

State (`AppState`), always describing the active language:
- `route`: `library | read | words | review`. Default `read`. Mirrors `location.hash`.
- `lang`, `pack`: active language and its `LanguagePack` (book, dictionary, `ttsLocale`, ...).
- `wordStates`: `lemma -> WordState`. A missing lemma is `new`; use `stateOf(lemma)`.
- `cards`: `{ lemma, sentenceId, schedule? }[]` in the order they were added. `schedule` is the FSRS `CardSchedule` (epoch milliseconds); a card without one has never been reviewed and counts as a new card due now.
- `bookmarks`: sentence ids of the active language.
- `books`: every book of the active language (the sample book first, then imported ones); `userBooks`: all imported books as stored.
- `pins`: book ids in pin order.
- `preferences`: `size, lh, font, paper, turn, hl, voice, lang, bookId, positions`. `voice` is `"system"` (Web Speech API, default) or `"server"` (Kokoro voice from the API); preferences stored before it existed load as `"system"` through the defaults merge in `AppStore.open`; see `../speech`. `positions` maps a book id (`pack.book.id` for the sample book, `StoredBook.id` for an imported one) to the sentence id the reader was on.
- `focusRequest`: pending `{ lemma, sentenceId }` set by the Words screen.
- `persistence`: `indexeddb` or `memory` (session-only fallback).

Actions (`AppActions`, stable identities):
- `navigate(route)`.
- `setWordState(lemma, "new" | "learning" | "known")`: applies `tapNew`, `tapLearning`, `tapKnown`. Returns `{ state, pulse }`; `pulse` is true when the word became learning.
- `addCard(lemma, sentenceId)`: ignored when the lemma already has a card. Applies `onCardAdded`. Returns `{ state, pulse, added }`.
- `removeCard(lemma)`: applies `onCardRemoved` (state unchanged). The review log keeps every entry of the removed card; `deleteBook` removes cards the same way and keeps the log too.
- `toggleBookmark(sentenceId)`, `togglePin(bookId)`.
- `setPreference(key, value)` for every preference except `lang`, `bookId` and `positions`.
- `switchLanguage(lang)`: async, see below; it also returns to the sample book of that language.
- `importEpub(files)`: builds a `Book` from an unpacked EPUB (`@glyphfern/core` import), asks the lemmatizer for the lemma of every word, stores the book and returns it. Sentence ids start at `seq * 1_000_000` so bookmarks and cards stay unique across books. The stored book has `lemmatized: true` only when the lemmatizer answered with a map; when it returns `null` (API unreachable, any chunk failed) or none is configured, the book is imported with lowercase surface forms as lemmas and `lemmatized: false`.
- `openBook(bookId)`: makes a sample or imported book the active one (`state.pack.book`) and remembers it in `preferences.bookId`.
- `deleteBook(bookId)`: removes an imported book with its cards, bookmarks, pin and reading position; word states stay.
- `rememberPosition(bookId, sentenceId)`: stores the reading position of a book. It never publishes a new state, so a page turn does not re-render the app; see Reading positions.
- `startReview()`: async. Builds the queue of a new review session: the cards due now plus new cards up to 10 per local day. It waits for pending writes, counts the first reviews logged since local midnight of `now()` (`countNewReviewsSince`) and returns `buildDueQueue(cards, now(), countedToday)`. A card without a schedule is a new card.
- `rateCard(queue, rating)`: returns the queue after `rateReviewCard` (again re-appends, hard reinserts at index 2, good and easy remove the head). When the head lemma has a card, it also rates it: `rateSchedule` gives the new schedule, which is saved on the card (in `state.cards` and the repository); one `ReviewLogEntry` `{ lemma, sentenceId, rating, reviewedAt, before, after }` is appended to the review log; the word state becomes `wordStateFromSchedule(after)`. A lemma without a card is never touched and nothing is logged.
- `requestFocus(request)` and `consumeFocus()`: the Words screen requests, the Reading screen consumes once. `consumeFocus` returns the request and clears it.

`ReaderView` (the Reading screen) is mounted all the time and hidden with `display: none` while another route is active, as the layout rule in the logic spec requires. It can read `state.route` to know whether it is visible.

## Relemmatizing imported books

`Lemmatizer` is `(lang, words) => Promise<Record<string, string> | null>`; `null` means unavailable or incomplete, never "no lemmas found". `AppStore.open` starts `relemmatizePending()` without awaiting it (tracked, so `settled()` waits for it). Concurrent calls share one run.

Flow, one book at a time for every user book whose `lemmatized` is not `true` (a missing flag counts as not lemmatized):
1. Send `bookWords(book)` to the lemmatizer. On `null` the book is left untouched and retried at the next app start.
2. Apply the map with `applyLemmas`, save the book with `lemmatized: true`, update `userBooks`, `books` and `pack`.
3. Build `lemmaChanges(before, after)`: old lemma to new lemma for every token whose lemma changed, then `migrateProgress` (`lemma-migration.ts`, pure) computes the new progress of the book's language:
   - a card whose `sentenceId` lies in this book and whose lemma changed moves to the new lemma with the same `sentenceId`; if a card for the new lemma already exists (including one moved earlier in the same run) the old card is deleted instead; cards of other books are never touched;
   - a word state of the old lemma is copied to the new lemma when the new lemma has none; the old entry stays because other books may still use it.
4. The changes are written through the repository. When the book's language is the active one they also patch `wordStates` and `cards` in the state; otherwise the snapshot in `loaded` (or the repository) is updated so a later language switch shows the migrated progress.

## Reading positions

A position is a sentence id, never a page. `preferences.positions` is one object shared by every `Preferences` value the store creates. `rememberPosition` writes into that object in place and saves the preferences, so `setPreference`, `openBook`, `switchLanguage` and `deleteBook` always save the latest positions. Saves go through one private helper that hands the repository a copy of the map. Remembering the position that is already stored writes nothing. Preferences stored before `positions` existed load with an empty map through the defaults merge in `AppStore.open`.

## Document effects

`AppProvider` applies preferences to the root element: `data-night` when `paper` is the night paper, class `calm` when `turn` is `still`, `data-font`, `--lh`, `--fs` (the property is removed at the default size so the mobile CSS default applies) and `data-lang`. `prefers-color-scheme` is never read. `prefers-reduced-motion` only chooses the default `turn` on a first run.

## Language switching (logic spec section 9)

1. Every change is written to the repository as it happens, so the current bookmarks and cards are already saved under the current language.
2. The target language is loaded once from the repository: word states, cards and bookmarks as stored; a first run has none.
3. Its bookmarks and cards replace the active ones.
4. `preferences.lang` changes and the provider sets `data-lang`.
5. `preferences.lang` is persisted and restored by `AppStore.open`.

A newer `switchLanguage` call supersedes an older one that is still loading.

## Storage

See `../storage`. IndexedDB (Dexie) tables: `wordStates` and `cards` keyed by `stateKey(lang, lemma)` (a card row also holds its schedule), `bookmarks` per language, `pins`, one `preferences` record, `meta` (unused since D-022, kept so existing databases open without a migration), `books`, and the append-only `reviewLog`. When IndexedDB cannot open, `createRepository` returns an in-memory repository and the app runs session-only. Writes are fire-and-forget; a failed write never reaches the UI. `AppStore.settled()` resolves when all pending writes ended (used by tests).

## Testing

`apps/web/test/app/store.test.ts` runs the store on the memory repository and on Dexie with `fake-indexeddb`. `review.test.ts` covers rating, the review log and `startReview` with an injected clock (`StoreOptions.now`, default `Date.now`, used for all scheduling). `books.test.ts` covers import and `relemmatize.test.ts` covers the lemmatized flag, retries and progress migration. Expected values come from the state table and review rules of the logic spec.
