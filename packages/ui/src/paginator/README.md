# Paginator

## Purpose

Turns one flow element laid out with CSS multi-column into pages and keeps the reading position anchored to a sentence, never a page number. Spec: `spec/web-reader-logic.md` section 2.

## Flow

1. `layout(anchor?)` returns immediately when the sheet has zero width.
2. The anchor defaults to the first sentence whose `endPage >= current page`.
3. Column width is the sheet width, gap is 20% of it (rounded), step is their sum.
4. The flow is reset to translateX(0) with transitions off, then sentences (`.s[data-s]`) and chapter headings (`h2[data-ch]`) are measured from client rects.
5. The final transform is written while transitions are still off, then transitions are restored, so a relayout never animates from page 0. While a transform transition runs, the sheet carries `data-turning` (CSS drops the 22px clip margin so neighbouring text never shows at the edges). `dispose()` removes the listeners.
6. The page is recomputed from the anchor sentence's `startPage`, transitions are restored and `go(page)` sets the transform to `-page * step` px.

## Contracts

- `geometry.ts` is pure; all arithmetic lives there and is unit-tested with hand-computed values.
- `paginator.ts` is a thin DOM adapter and needs a real browser layout to be exercised.
- `go(page)` clamps to `[0, pages - 1]`. The slide transition itself is CSS.
- Progress ratio is `page / (pages - 1)`, and 0 for a single page.

## Testing

Run `bun test packages/ui`. The adapter is verified in a real browser only.
