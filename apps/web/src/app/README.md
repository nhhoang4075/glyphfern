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
- `cards`: `{ lemma, sentenceId }[]` in the order they were added.
- `bookmarks`: sentence ids of the active language.
- `books`: every book of the active language (the sample book first, then imported ones); `userBooks`: all imported books as stored.
- `pins`: book ids in pin order (all languages and placeholder books).
- `preferences`: `size, lh, font, paper, turn, hl, lang, bookId, positions`. `positions` maps a book id (`pack.book.id` for the sample book, `StoredBook.id` for an imported one) to the sentence id the reader was on.
- `focusRequest`: pending `{ lemma, sentenceId }` set by the Words screen.
- `persistence`: `indexeddb` or `memory` (session-only fallback).

Actions (`AppActions`, stable identities):
- `navigate(route)`.
- `setWordState(lemma, "new" | "learning" | "known")`: applies `tapNew`, `tapLearning`, `tapKnown`. Returns `{ state, pulse }`; `pulse` is true when the word became learning.
- `addCard(lemma, sentenceId)`: ignored when the lemma already has a card. Applies `onCardAdded`. Returns `{ state, pulse, added }`.
- `removeCard(lemma)`: applies `onCardRemoved` (state unchanged).
- `toggleBookmark(sentenceId)`, `togglePin(bookId)`.
- `setPreference(key, value)` for every preference except `lang`, `bookId` and `positions`.
- `switchLanguage(lang)`: async, see below; it also returns to the sample book of that language.
- `importEpub(files)`: builds a `Book` from an unpacked EPUB (`@glyphfern/core` import), stores it and returns it. Sentence ids start at `seq * 1_000_000` so bookmarks and cards stay unique across books.
- `openBook(bookId)`: makes a sample or imported book the active one (`state.pack.book`) and remembers it in `preferences.bookId`.
- `deleteBook(bookId)`: removes an imported book with its cards, bookmarks, pin and reading position; word states stay.
- `rememberPosition(bookId, sentenceId)`: stores the reading position of a book. It never publishes a new state, so a page turn does not re-render the app; see Reading positions.
- `ratingApplied(lemma, rating)`: applies `onRated` to one lemma and returns the new state.
- `rateCard(queue, rating)`: applies `rateReviewCard` to the head of the queue, commits the state change and returns the new queue.
- `requestFocus(request)` and `consumeFocus()`: the Words screen requests, the Reading screen consumes once. `consumeFocus` returns the request and clears it.

`ReaderView` (the Reading screen) is mounted all the time and hidden with `display: none` while another route is active, as the layout rule in the logic spec requires. It can read `state.route` to know whether it is visible.

## Reading positions

A position is a sentence id, never a page. `preferences.positions` is one object shared by every `Preferences` value the store creates. `rememberPosition` writes into that object in place and saves the preferences, so `setPreference`, `openBook`, `switchLanguage` and `deleteBook` always save the latest positions. Saves go through one private helper that hands the repository a copy of the map. Remembering the position that is already stored writes nothing. Preferences stored before `positions` existed load with an empty map through the defaults merge in `AppStore.open`.

## Document effects

`AppProvider` applies preferences to the root element: `data-night` when `paper` is the night paper, class `calm` when `turn` is `still`, `data-font`, `--lh`, `--fs` (the property is removed at the default size so the mobile CSS default applies) and `data-lang`. `prefers-color-scheme` is never read. `prefers-reduced-motion` only chooses the default `turn` on a first run.

## Language switching (logic spec section 9)

1. Every change is written to the repository as it happens, so the current bookmarks and cards are already saved under the current language.
2. The target language is loaded once through `ensureLanguage`: first run seeds known words, learning words and one starter card per learning lemma pointing at its first body occurrence; later runs read what was stored.
3. Its bookmarks and cards replace the active ones.
4. `preferences.lang` changes and the provider sets `data-lang`.
5. `preferences.lang` is persisted and restored by `AppStore.open`.

A newer `switchLanguage` call supersedes an older one that is still loading.

## Storage

See `../storage`. IndexedDB (Dexie) tables: `wordStates` and `cards` keyed by `stateKey(lang, lemma)`, `bookmarks` per language, `pins`, one `preferences` record, `meta` (seeded flags). When IndexedDB cannot open, `createRepository` returns an in-memory repository and the app runs session-only. Writes are fire-and-forget; a failed write never reaches the UI. `AppStore.settled()` resolves when all pending writes ended (used by tests).

## Testing

`apps/web/test/app/store.test.ts` runs the store on the memory repository and on Dexie with `fake-indexeddb`. Expected values come from the state table and review rules of the logic spec and from the prototype starter data.
