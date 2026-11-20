# Reader

## Purpose

The Reading screen (`ReaderView`). With no open book (`pack.book.chapters` is empty) it renders `EmptyReader`: a fern, the text "Chưa có sách" and a button that navigates to the library. The paginator, curl engine and page controls exist only while a book is open: `ReaderView` switches between `EmptyReader` and the book reader, so nothing in the book reader sees an empty book. It is mounted for the whole session and hidden by the shell with `display: none` when another route is active, so the layout and the reading position survive route changes.

## Flow

1. `Flow` renders only the chapter window (`chapter-window.ts`: the current chapter and its neighbours, fewer at the book ends), chapter headings `h2[data-ch]`, paragraphs, sentence spans `.s[data-s]`, word spans `.w` with `data-s`, `data-i`, `data-l`, `data-g` and `data-u` for unmatched tokens). It is memoised on the pack and the window. Word state classes (`l1`..`l3`, none on `data-u` words, which also lose `nw`; the page-curl texture reads these classes so it shows nothing for them), selection (`sel`, `grp`) and animation classes (`pulse`, `hlin`) are applied imperatively in layout effects so React never rewrites them.
2. `ReaderView` creates the paginator from `@glyphfern/ui` on the flow and sheet elements. Size, line height and font changes reach the reader only after they stay unchanged for 150 ms (`useSettledLayoutKey`, `app/settle.ts`), so a slider drag relayouts once. A `ResizeObserver` size change sets `data-settling` on the sheet (the flow is hidden) and relayouts after 150 ms without further resizes; the first non-empty size relayouts at once. Font set events and a pack change call `relayout` directly. After layout the icons are preloaded with `preloadIcons`; a curl turn collects segments only for the blocks touching the two pages involved (`blockElementsOnPages`). `relayout` waits one animation frame (so the document preference effects have applied), then calls `layout` with the anchor sentence. A pending anchor (focus request) wins over the sentence on the current page.
3. Page state (`page`, `pages`, current chapter, its start page and page count) is mirrored into React from the paginator by `sync`. Pages are numbered inside the window. The progress bar (`reading-progress.ts`: `(words before the chapter + page fraction * chapter words) / total words`), buttons and bookmark state read that mirror. The bar is a read-only indicator: a line and a fill, no marker, no chapter ticks and no pointer or keyboard handling.
4. Turning: `slide` and `still` call `go`; `curl` delegates to `createPageCurl`. The curl engine gets its textures from `collectSegments` and `drawPage`, and the DOM fold fallback copies the flow into the hidden under layer.
5. A tap on a word sets the panel state. The panel reads the sentence and token from the pack, and every state change goes through `useApp().actions`.
6. Reading position: the reader remembers the sentence returned by `sentenceOnCurrentPage` (the first sentence whose `endPage` is at or after the page) through `rememberPosition`, only after a user driven page change (turn, seek, chapter or bookmark jump, keyboard focus on a word, curl turn). Layout, re-anchoring after a resize and font loading never save. When the book changes (app start, `openBook`) the layout effect anchors on the remembered sentence if the book contains it (`openingSentenceId`), otherwise on the first chapter title. This path never opens the word panel and highlights nothing.
7. Window shifts: when the sentence on the current page belongs to another chapter than the window centre, `shiftWindow` re-centres the window and calls `layout({ chapter, offset })`, which keeps the same visible page. After a slide it runs once the flow transition has finished (`data-turning` gone); after a curl turn it runs at once; a turn attempted at a window edge shifts first. Jumps (contents, search, bookmarks, restored position, focus request) to a chapter outside the window rebuild the window around the target chapter and land on the sentence.
8. Contents rows show the chapter progress bar (1 before the current chapter, the page fraction for it, 0 after) and an estimated start page `round(words before / words per page) + 1`, where words per page is the window words over the window pages; the current chapter shows the estimate plus its page offset. The library card progress uses the word position of the saved sentence.
9. A muted page number sits between the prev and next buttons: `round(words before the current page / words per page) + 1` with the same words per page as the contents estimate; it is hidden while the layout is unsettled. The sheet keeps a bottom band (54px) so the buttons never overlap text.
10. A focus request from the Words screen is consumed once: the paginator is anchored to the sentence and the word is opened.

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

For an `unmatched` token the word panel renders the word, the speaker button, "Chưa tra được nghĩa" and the sentence block with its buttons; the state buttons and the card button are not rendered and no lookup request is made. The Words screen leaves unmatched tokens out of its rows, and `coverage` (`@glyphfern/core`) leaves them out of the percentage and the new and learning counts.
