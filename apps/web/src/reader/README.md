# Reader

## Purpose

The Reading screen (`ReaderView`). It is mounted for the whole session and hidden by the shell with `display: none` when another route is active, so the layout and the reading position survive route changes.

## Flow

1. `Flow` renders the active pack once (chapter headings `h2[data-ch]`, paragraphs, sentence spans `.s[data-s]`, word spans `.w` with `data-s`, `data-i`, `data-l` and `data-g`). It is memoised on the pack. Word state classes (`l1`..`l3`), selection (`sel`, `grp`) and animation classes (`pulse`, `hlin`) are applied imperatively in layout effects so React never rewrites them.
2. `ReaderView` creates the paginator from `@glyphfern/ui` on the flow and sheet elements. A `ResizeObserver` on the sheet, the font set events, and changes of size, line height, font or pack call `relayout`. `relayout` waits one animation frame (so the document preference effects have applied), then calls `layout` with the anchor sentence. A pending anchor (language switch, focus request) wins over the sentence on the current page.
3. Page state (`page`, `pages`, chapter start pages) is mirrored into React from the paginator by `sync`. The track, buttons and bookmark state read that mirror.
4. Turning: `slide` and `still` call `go`; `curl` delegates to `createPageCurl`. The curl engine gets its textures from `collectSegments` and `drawPage`, and the DOM fold fallback copies the flow into the hidden under layer.
5. A tap on a word sets the panel state. The panel reads the sentence and token from the pack, and every state change goes through `useApp().actions`.
6. A focus request from the Words screen is consumed once: the paginator is anchored to the sentence and the word is opened.

## Contracts

- Sentence ids are numbers in `@glyphfern/core` and strings in the DOM and the paginator. `sentenceKey` and `parseSentenceKey` are the only conversion points.
- Bookmarks store the first sentence of the page. A page is bookmarked when any bookmarked sentence touches it; the bookmark button removes all of them or adds one.
- `readerLogic.ts` holds the pure rules (reveal state, Esc order, popover placement, drawer progress, bookmark lookup, search marks, group handling). `track.ts` holds the tick and seek maths.
- Highlight strips are SVG data URIs whose fill is written as `rgba(...)` so that `collectSegments` can read the colour for the curl textures.
- Chapter title words are tappable except roman numerals. A card made from a title word references the title sentence id.

## Failure modes

- Zero-width sheet: the paginator does nothing and `relayout` retries when the observer fires again.
- No WebGL: the engine switches to the DOM fold.
- Missing dictionary entry: the panel shows the word with empty chips and meaning.

## Testing

Pure helpers are unit tested with values derived from the specs. Layout, curl and panel behaviour are checked in a real browser.
