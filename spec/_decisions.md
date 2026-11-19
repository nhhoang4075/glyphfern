# Decisions

Each entry: id, date, who decided, what, why, what it replaces.

## D-001 Visual direction: Glyphfern
- Date: 2026-11-19. Decided by: owner.
- Glyphfern is the only visual direction. The earlier working title and direction Lexmoth (moth and lamp) is dropped; the product name is Glyphfern.
- Reason: owner reviewed both on the same layout and chose Glyphfern.

## D-002 Light by default, manual night mode, no system dark mode
- Date: 2026-11-19. Decided by: owner.
- Default surface is light. The artifact and app MUST NOT follow `prefers-color-scheme`.
- A night paper swatch inside the Aa menu switches the whole app to a night palette.
- Reason: the owner finds system dark themes hard to read but wants a night option for low light, chosen by hand.

## D-003 No explanatory text in the UI
- Date: 2026-11-19. Decided by: owner.
- Controls are icons and shapes. Names live in `aria-label` and tooltips. Text in the UI is content only (book text, word, meaning, notes).

## D-004 Reduced-motion is a user setting inside Aa
- Date: 2026-11-19. Decided by: owner.
- Third page-turn style "still" disables curl, slide and nearly all transitions. It is independent of the OS setting. The app SHOULD also select "still" by default when the OS requests reduced motion.

## D-005 Page turn: curl is a way to turn, not the only way
- Date: 2026-11-19. Decided by: owner.
- Prev/next buttons stay visible at all times. Corner dragging, tapping the corner, arrow keys and swiping are alternative inputs. No idle dog-ear on the page.

## D-006 Fullscreen means the book page, not the browser
- Date: 2026-11-19. Decided by: owner.
- Fullscreen hides the dock and the top bar so the page fills the app area. The app MUST NOT call the browser Fullscreen API.

## D-007 Chapter titles are tappable words
- Date: 2026-11-19. Decided by: owner.

## D-008 Highlights can be turned off
- Date: 2026-11-19. Decided by: owner.
- A Highlights on/off switch lives in Aa. Turning on plays a left-to-right wipe.

## D-009 Pinned books
- Date: 2026-11-19. Decided by: owner.
- Books can be pinned and pinned books sort first in the library. The "add book" control is a slim bar at the top, not a book-sized tile.

## D-010 Korean is a supported language, demonstrated at word level
- Date: 2026-11-19. Decided by: owner (asked to build the demo).
- Korean tokens are eojeol (space-separated units). The panel shows a morpheme breakdown (stem, particle, ending) with a gloss per morpheme.
- Open: the real morphological analyzer (for example Kiwi or MeCab-ko) is not chosen. See `web-reader-logic.md` section 9.

## D-011 Page-curl shadow has two branches, as in the prototype shader
- Date: 2026-11-19. Decided by: owner ("do it like the demo, the demo is good").
- Shadow on the turned page: `0.12 * exp(-(t-a)/26)` when `a > pi*R`, `0.09 * exp(-(t-a)/24)` when `a <= pi*R`.
- Reason: the first spec text listed only the first branch; the implemented shader the owner approved has both.
