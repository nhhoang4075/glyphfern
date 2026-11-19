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

## D-012 Cover radius, cover title font and coverage scope follow the prototype
- Date: 2026-11-19. Decided by: owner ("do it like the demo").
- Cover radius 20px; cover title in Lexend 600 at 1.05rem; coverage counts body sentences only.
- Reason: the first spec text copied older prototype values.

## D-013 Reader values follow the prototype where the first spec text differed
- Date: 2026-11-19. Decided by: owner ("the spec was made from the demo, the demo is right").
- Mobile breakpoint is 760px (dock, sheet insets, drawer); the side panel docks at 1100px.
- Top bar 64px, 56px at 760px and below. Progress track: 3px tinted line with a `--wing` to `--lamp` fill.
- State buttons: new `--ink-2`, learning `--lamp`, known `--ok`, card `--wing`. Page radius 26px.
- Esc closes panel, drawer and popover together; fullscreen exits only when none was open.
- Reason: the first spec text transcribed these values incorrectly from the prototype.

## D-014 Bottom sheet is wider than the reading page
- Date: 2026-11-19. Decided by: owner (asked for the sheet to be a little wider than the page).
- Original choice: bottom sheet max width 560px, narrower than the 576px page. Now 624px.
- The progress track keeps its centred position when the word panel is a bottom sheet (below 1100px); it only shifts left while the side panel is open (1100px and above), with its width reduced so it never covers the Contents button.
- Reason: the track overlapped the Contents button and the dock at 761px to 1099px whenever the panel was open.

## D-015 Pronunciation chip follows the lemma chip
- Date: 2026-11-19. Decided by: owner.
- Original order: part of speech, pronunciation, lemma chip. Now: part of speech, lemma chip, pronunciation, morpheme chips.
- Reason: the pronunciation belongs to the lemma, so it reads naturally right after it.

## D-016 Users add their own books as EPUB files
- Date: 2026-11-19. Decided by: owner ("add books in the standard format").
- EPUB (DRM-free) is imported on the device: chapters from the spine, sentences and words from `Intl.Segmenter`. Imported books live in IndexedDB; word states are shared per language, bookmarks and cards stay unique through sentence id ranges (`seq * 1_000_000`).
- Known limits of the first version: the lemma is the lowercase surface (no lemmatizer), imported words have no meaning, pronunciation or translation until the AI lookup exists, Spanish only.

## D-017 Word notes for looked-up words come from Wiktionary facts
- Date: 2026-11-19. Decided by: owner (picked three kinds of fact out of what Wiktionary offers).
- The note under the bulb for a word without a static dictionary entry is built from Wiktionary: gender, plural and feminine form; usage and region labels per sense; for verbs, irregularity, stem or spelling change and the key forms that break the regular pattern.
- Not used: etymology, examples, synonyms, derived terms. Static dictionary entries keep their hand-written notes.
- Reason: these facts are accurate, cheap and need no machine translation; labels are worded in Vietnamese by a fixed table.


## D-018 Vietnamese meanings for looked-up words are deferred
- Date: 2026-11-19. Decided by: owner ("note it, not now").
- Words outside the static dictionary show English glosses only. Machine translation of single glosses was tried and dropped: it returned the word unchanged or a wrong sense ("zorro" became a vulgar word).
- Options when this is picked up: Vietnamese Wiktionary (free, partial coverage), an LLM short definition with a cache (best quality, has a cost), or a hybrid. The `Translator` interface in `apps/api` is the place to plug a provider in.

## D-019 Review cards cover words of imported books
- Date: 2026-11-19. Decided by: owner (asked that imported words show a meaning in review).
- Original choice: the review queue held only cards whose lemma had a static dictionary entry.
- Now every card is queued. Without a static entry the back shows the looked-up lemma, IPA, English glosses and Wiktionary note; when the lookup fails it shows the lemma and "Chưa tra được nghĩa".
- Reason: words from imported books never reached review.

## D-020 Review scheduling uses FSRS and word state follows the schedule
- Date: 2026-11-19. Decided by: owner ("approve item 1"); the thresholds are the proposed defaults.
- Original choice: review was a session queue; "again" and "hard" left the word state unchanged, "good" lowered the level, "easy" made the word known at once.
- Now: `ts-fsrs` with request retention 0.9, `enable_fuzz` off (so the log reproduces the schedule), default weights and learning steps. An append-only review log records every rating. The queue holds due cards plus up to 10 new cards per local day.
- Word state of a word with a card is derived from stability: under 3 days level 3, 3 to 14 level 2, 14 to 60 level 1, 60 and above known. Forgetting is therefore automatic: a lapse lowers stability and the word becomes learning again.
- "Easy" no longer forces known by itself (owner did not choose the alternative; this is the default). A word marked known without a card is never forgotten.
- Reason: the session queue had no memory across days and no forgetting.

