# Web reader: UI specification

Scope: `apps/web` (PWA). Visual direction is Glyphfern (D-001). All user-facing strings are Vietnamese; this file is English.

## 1. Principles

1. UI text is content, not instruction. Controls are icons and shapes. Names go in `aria-label` and hover tooltips (D-003).
2. Word state is shown by the highlight, never by a label. Known and new words carry no highlight.
3. Chrome is quiet, the page is the focus. Top bar has icons only and shares the app background.
4. One motivated animation moment per action. Everything else changes without long transitions.
5. Light by default. Night is chosen manually in Aa (D-002). `prefers-color-scheme` MUST NOT be used.
6. Touch targets: at least 42px for bar buttons, 54px for the three state buttons in the word panel.
7. Nothing the user does may leave a visual artifact: no clipped rings, no half-faded boxes, no elements falling or jumping.

## 2. Layout

| Breakpoint | Navigation | Word panel | Page |
| --- | --- | --- | --- |
| width >= 1100px | vertical dock on the left (rail) | side panel on the right, 350px wide; page shifts left (padding-right 380px) | centred, book width `min(36rem, 100%)`, max height 900px |
| width < 1100px | bottom dock | bottom sheet, max height 62%, max width 624px, top corners 26px | full width |
| width <= 760px | bottom dock, white `#FDFEFC`, 1px top border `--line`, no shadow, padding 8px top and 8px + safe-area bottom | same sheet | sheet insets 34px top, 26px right, 52px bottom, 34px left |

Mobile drawer and its scrim are `position: fixed`, full viewport height, above the dock (z-index 45 and 44). The word panel is also above the dock.

Reading sheet insets (inside the book): desktop 44/46/56/52px (top/right/bottom/left) in the original prototype base, the final design uses 46/50/42/50. In fullscreen: 58/62/62/66px; on mobile fullscreen 50/26/58/30px. The bottom inset leaves room for the prev/next buttons.

## 3. Screens

### 3.1 Library
- Grid `repeat(auto-fill, minmax(150px, 1fr))`, gap 34px 26px, max width 880px. Two columns at width <= 540px.
- First item: **add-book bar**, full grid width (`grid-column: 1 / -1`), 52px high, radius 14px, plus icon 22px. It MUST NOT be a book-sized tile.
- Book card: cover 2:3, radius 20px, gradient from the book colour pair, a generated art motif, title in sans (Lexend) weight 600 at 1.05rem, progress bar 5px at the bottom edge (colour `--lamp`), a language flag chip under the cover.
- **Pin**: a 32px round button at the top right of the cover. Shown on hover (desktop) and always (hover: none). Pinned: white fill, `--wing` icon, filled. Pinned books sort first, in pin order; the rest keep their order (D-009).
- Tapping a book opens it in Reading and switches the active language to the book language (see logic spec section 9).

### 3.2 Reading
Elements: top bar, page (book), prev/next buttons, word panel, Aa popover, drawer, dock.

**Top bar** (64px, 56px at width <= 760px, icons only, background = app background):
- Contents (opens drawer), progress track, bookmark, Aa, fullscreen.
- Track: a line with 24px transparent side borders. The line is 3px and tinted green `rgba(46,106,78,.16)`, with a 3px fill in `--wing` showing reading progress (width animates .45s). The track is a read-only indicator: it has no marker and no chapter ticks and does not respond to taps or keys; jumping to a chapter is done from the contents drawer.
- There is exactly one progress indicator in the top bar. The coverage ring is shown only in the Words screen.
- Bookmark icon is outline when the current page has no bookmark and filled when it has.

**Page (book)**:
- Radius 26px, 1px `--line` ring plus a soft shadow (45% of the original prototype shadow opacity). No spine or fake page edges. No idle dog-ear.
- Chapter heading: fern glyph 44px, then the title in uppercase sans, weight 600, letter spacing .14em. Chapter titles are tappable words (D-007).
- Text: serif, size `--fs` (17-28px, default 21; 19 on mobile), line height `--lh` (1.45/1.62/1.85).
- Prev/next buttons: small round buttons centred at the bottom of the page, always visible, never hidden by the page turn style (D-005). The text area reserves a bottom band at least as tall as the buttons plus 8px, so the buttons never overlap book text at any font size or line height.

**Highlight styles** (Glyphfern):
| State | Appearance |
| --- | --- |
| new, known | none |
| learning level 1 | rounded strip, `#C2D94C` at 38% alpha |
| learning level 2 | same strip at 60% alpha |
| learning level 3 | same strip at 85% alpha |
| selected word | solid `--wing` box, white text (dark text `#0F1814` in night), radius 5px, horizontal padding .08em with equal negative margin, bottom padding 3px, no outer ring |
| other parts of a multi-token unit | `--wing-soft` box, same geometry |
| hover | `rgba(46,106,78,.1)` background |
The strip is `.42em` high, anchored `.07em` above the bottom of the word box, with 3.5px radius. It is drawn as one rounded shape (not a gradient) so the corners stay round.
The selected box appears immediately (no fade in); it fades out on deselect over .25s through box-shadow only. Background-position MUST NOT transition (it would make strips fall from the top).
Selecting a word at the left or right text edge MUST NOT clip the selection; the sheet clips with an `overflow-clip-margin` of 22px, which only exposes the gap between columns (gap = 20% of page width).
The selection MUST NOT cover neighbouring glyphs or glyphs on the next line.

**Pulse**: when a word first becomes learning or gets a card, a ring expands from 0 to 18px in `rgba(194,217,76,.9)` fading to 0 over .9s. The selection box does not change size during or after the pulse.

**Highlight switch**: turning highlights on adds a wipe, strips grow left to right in .7s (`cubic-bezier(.25,.6,.3,1)`), transitions disabled during the wipe; turning off removes strips instantly. The selection stays visible while highlights are off.

### 3.3 Word panel
Top to bottom:
1. Word (serif 2.15rem) and a speaker button (pronounce the word, rate 0.88).
2. Chips, in this order: part of speech (spelled out: never "dt", "đg"), lemma chip with a sprout icon only when the lemma differs from the tapped surface, pronunciation of the lemma (IPA), and for languages with morphology one chip per morpheme: bold form and gloss.
3. Meaning (Vietnamese).
4. Word note (bulb icon) when the dictionary has one.
5. State buttons: three icon buttons (new = circle, learning = flame, known = check) forming a segmented group, and a card button (cards-plus icon) at the right. The active state is a solid fill with a visible icon: new = `--ink-2` with white icon, learning = `--lamp`, known = `--ok`, card button = `--wing`. All inactive buttons use the tinted tile colour.
6. Context box: the sentence with the word marked, then three round white buttons: speak sentence (rate 0.78), translate, grammar analysis.
7. Revealed blocks (translation, grammar notes) expand below with a height and opacity animation of .38s (`grid-template-rows 0fr -> 1fr`). Closed state has no layout gap. Opening a different word resets both toggles.

Colour hierarchy inside the panel: the panel surface is `#FDFEFC` (white), tiles inside it are tinted (`--paper-2`). Buttons that sit on a tinted tile are white, except when active.

### 3.4 Aa popover
Rows, each a segmented control of icon buttons: size slider (A small / A large), line height (three icons), highlights on/off, page-turn style (slide, curl, still), font (serif / sans sample), paper (three swatches: white `#FCFBF9`, linen `#F1EDE4`, night `#1B2420`), reading voice (two text buttons: "Giọng máy" for the system voice, "Giọng AI" for the server voice; see logic spec §10).
- Placement: right edge aligned with the Aa button, top = button bottom + 4px, width `min(290px, 100% - 16px)` on mobile.
- Surface `#FDFEFC`, tiles tinted. Choosing the night swatch applies the night palette to the whole app.
- "Still" disables curl and slide, and sets all transition and animation durations to .01ms inside the app (D-004).

### 3.5 Drawer
Left drawer with three tabs (contents, bookmarks, search). On mobile it is full height and covers the dock.
- Contents: one row per chapter with fern mark, title, and a progress bar showing how much of that chapter is behind the current page. Each row also shows the estimated page number of the chapter's start, right-aligned.
- Bookmarks: sentence snippets, each with a remove button; tapping jumps to the sentence page.
- Search: input with magnifier icon. Matches by lemma and by surface prefix; each hit is the full sentence with matches marked. Empty result shows an icon only.

### 3.6 Words
- Header: coverage ring (percent of known tokens), count of new lemmas, count of learning lemmas, count of cards, each as icon plus number.
- Two filters as icons: learning, known.
- Rows: glow dot (brightness equals level, green for known), lemma, meaning. Tapping a row switches to Reading, jumps to the sentence and opens the word.
- Empty list shows an icon only.

### 3.7 Review
- One card in the centre. Five or more dots show progress: done, current, upcoming.
- Front: sentence with the target word blanked. Tapping the card flips it: shows lemma, pronunciation, meaning, example, reads the sentence aloud and enables the four rating buttons.
- Four round rating buttons (again, hard, good, easy), disabled until flipped.
- Empty queue shows the rest illustration (fern glyph and check).

### 3.8 Fullscreen reading
Hides dock and top bar; the page fills the app area. A thin strip at the top reveals the bar for 3.2s when touched or hovered. Tapping a word still opens the word panel. Esc exits (if a panel, drawer or popover is open, one press closes all of them and fullscreen stays). Browser Fullscreen API MUST NOT be used (D-006).

## 4. Page turning

Three styles, selected in Aa (`turn`): `slide`, `curl`, `still`.
- `slide`: the text flow translates by one page step, .5s ease.
- `curl`: GL page curl, see logic spec section 7.
- `still`: pages change instantly; no curl, no corner drag.
Inputs for all styles: prev/next buttons, ArrowLeft/ArrowRight, horizontal swipe on touch, and in `curl` style dragging or tapping the bottom corners.
Turning a page closes any open word panel.

## 5. Themes and tokens

| Token | Light | Night |
| --- | --- | --- |
| `--bg` | `#E6EDE7` | `#111714` |
| `--paper` | `#FBFCFA` (page paper follows the paper swatch) | `#1B2420` |
| `--paper-2` (tiles) | `#EDF3EE` | `#232D28` |
| `--paper-3` | `#EFEFE4` | `#202A25` |
| `--ink` | `#1D2A24` | `#E3EAE5` |
| `--ink-2` | `#5A6A61` | `#A6B3AB` |
| `--ink-3` | `#9BAAA1` | `#6D7B73` |
| `--line` | `#D2DDD5` | `#2C3832` |
| `--wing` (controls) | `#2E6A4E` | `#7CC4A0` |
| `--wing-soft` | `#D9EADF` | `#243A2F` |
| `--lamp` (learning) | `#C2D94C` | `#C2D94C` |
| `--ok` | `#2E8B6A` | same |
| `--bad` | `#C2554E` | same |
| Word panel and Aa surface | `#FDFEFC` | night surface |
| Mobile dock | `#FDFEFC` | night surface |

- Fonts: Literata (serif, book and words), Lexend (sans, interface).
- Radii: 10 / 16 / 24px; page 26px; cover 20px.
- Shadows: all app shadows are 45% of the original opacity. Dock has no shadow, only a top border.
- Hover on night surfaces MUST keep legible text (no grey hover with white text).

## 6. Icon map (each icon has exactly one role)

| Icon | Role |
| --- | --- |
| shelf | Library |
| open book | Reading |
| notebook with lines | Words |
| two stacked cards | Review |
| list with dots | Contents |
| bookmark | Bookmark (filled when marked) |
| Aa | Text and paper |
| magnifier | Search |
| speaker | Pronounce |
| translate (A with glyph) | Show translation |
| sparkle | Show grammar analysis |
| bulb | Word note |
| circle / flame / check | State: new / learning / known |
| cards-plus | Add or remove card |
| sprout | Lemma chip |
| pen | Highlights on; same pen crossed out = off |
| arrow / page / two bars | Page turn style: slide / curl / still |
| pin | Pin book |
| plus | Add book |
| expand / shrink | Fullscreen |

## 7. Accessibility

- Every icon button has an `aria-label`; toggles use `aria-pressed`; tabs use `aria-selected`; the dock uses `aria-current`.
- Reading order of the page follows the text. Words are buttons reachable by keyboard.
- Contrast of highlight strips against all three papers MUST be verified before release (not yet measured).
- Reduced motion: the "still" mode plus OS preference default (D-004).

### 7.1 App icon and install

- Mark: the fern glyph in `--lamp` (`#c2d94c`) on a vertical gradient from `#357a58` to `#1f4a37`. Sources are SVG files in `assets/icons`; `bun scripts/build-icons.ts` renders the PNG files into `apps/web/public`.
- Files: `favicon.svg` and `favicon-32.png` (browser tab), `apple-touch-icon.png` 180px full-bleed (iOS home screen), `icon-192.png` and `icon-512.png` with rounded corners (`any`), `icon-maskable-512.png` full-bleed with the glyph inside the central 80% (`maskable`).
- `manifest.webmanifest`: name and short name Glyphfern, language `vi`, `display: standalone`, `theme_color` `#2e6a4e`, `background_color` `#e6ede7` (the light `--bg`).
- The app is installable from the browser; offline use is not part of this section.

## 8. Not yet verified (prototype)

Touch swipe on real devices, real speech voices across devices, screen-reader behaviour, colour contrast on every paper, curl animation playback on low-end GPUs, Safari clipping of the selection ring (no support for `overflow-clip-margin`).
