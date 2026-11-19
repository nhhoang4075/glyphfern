# Reader

## Purpose

The Reading screen (`ReaderView`). With no open book (`pack.book.chapters` is empty) it renders `EmptyReader`: a fern, the text "Chưa có sách" and a button that navigates to the library. The paginator, curl engine and page controls exist only while a book is open: `ReaderView` switches between `EmptyReader` and the book reader, so nothing in the book reader sees an empty book. It is mounted for the whole session and hidden by the shell with `display: none` when another route is active, so the layout and the reading position survive route changes.

## Flow

1. `Flow` renders the active pack once (chapter headings `h2[data-ch]`, paragraphs, sentence spans `.s[data-s]`, word spans `.w` with `data-s`, `data-i`, `data-l` and `data-g`). It is memoised on the pack. Word state classes (`l1`..`l3`), selection (`sel`, `grp`) and animation classes (`pulse`, `hlin`) are applied imperatively in layout effects so React never rewrites them.
2. `ReaderView` creates the paginator from `@glyphfern/ui` on the flow and sheet elements. Size, line height and font changes reach the reader only after they stay unchanged for 150 ms (`useSettledLayoutKey`, `app/settle.ts`), so a slider drag relayouts once. A `ResizeObserver` size change sets `data-settling` on the sheet (the flow is hidden) and relayouts after 150 ms without further resizes; the first non-empty size relayouts at once. Font set events and a pack change call `relayout` directly. After layout the icons are preloaded with `preloadIcons`; a curl turn collects segments only for the blocks touching the two pages involved (`blockElementsOnPages`). `relayout` waits one animation frame (so the document preference effects have applied), then calls `layout` with the anchor sentence. A pending anchor (focus request) wins over the sentence on the current page.
3. Page state (`page`, `pages`, chapter start pages) is mirrored into React from the paginator by `sync`. The progress bar, buttons and bookmark state read that mirror. The bar is a read-only indicator: a line, a fill and the fern marker, no chapter ticks and no pointer or keyboard handling.
4. Turning: `slide` and `still` call `go`; `curl` delegates to `createPageCurl`. The curl engine gets its textures from `collectSegments` and `drawPage`, and the DOM fold fallback copies the flow into the hidden under layer.
5. A tap on a word sets the panel state. The panel reads the sentence and token from the pack, and every state change goes through `useApp().actions`.
6. Reading position: the reader remembers the sentence returned by `sentenceOnCurrentPage` (the first sentence whose `endPage` is at or after the page) through `rememberPosition`, only after a user driven page change (turn, seek, chapter or bookmark jump, keyboard focus on a word, curl turn). Layout, re-anchoring after a resize and font loading never save. When the book changes (app start, `openBook`) the layout effect anchors on the remembered sentence if the book contains it (`openingSentenceId`), otherwise on the first chapter title. This path never opens the word panel and highlights nothing.
7. A focus request from the Words screen is consumed once: the paginator is anchored to the sentence and the word is opened.

## Contracts

- Sentence ids are numbers in `@glyphfern/core` and strings in the DOM and the paginator. `sentenceKey` and `parseSentenceKey` are the only conversion points.
- Bookmarks store the first sentence of the page. A page is bookmarked when any bookmarked sentence touches it; the bookmark button removes all of them or adds one.
- `reader-logic.ts` holds the pure rules (reveal state, Esc rule: one press closes every open layer, fullscreen exits only when none was open, popover placement, drawer progress, bookmark lookup, search marks, group handling).
- Highlight strips are SVG data URIs whose fill is written as `rgba(...)` so that `collectSegments` can read the colour for the curl textures.
- Chapter title words are tappable except roman numerals. A card made from a title word references the title sentence id.

## Failure modes

- Zero-width sheet: the paginator does nothing and `relayout` retries when the observer fires again.
- No WebGL: the engine switches to the DOM fold.
- Missing dictionary entry: the panel shows the word with empty chips and meaning.

## Testing

Pure helpers are unit tested with values derived from the specs. Layout, curl and panel behaviour are checked in a real browser.
