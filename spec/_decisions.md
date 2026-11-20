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


## D-021 Neural reading voice is Kokoro on the server
- Date: 2026-11-19. Decided by: owner ("Kokoro, run on the server").
- Original choice: Web Speech API only, with a `Tts` port planned for local neural and cloud voices.
- Now: a second adapter `server`. A small Python service (`apps/tts`, kokoro-onnx with the int8 model and espeak-ng for Spanish phonemes) synthesizes speech; the Bun API exposes `GET /tts`, caches the audio in Postgres and applies the same client limits as translation. System voice stays the default; the reading voice is a preference.
- Spanish voice: `em_alex` by default (owner changed it from `ef_dora` on 2026-11-20), set by `TTS_VOICE_ES`.
- Reason: free, no per-character bill, Spanish voices of acceptable quality, and no 120 MB download on every device. `kokoro-js` was not usable because it ships English voices and an English-only phonemizer.
- Rejected: Piper (per-voice licences, one model per voice), Cloudflare Aura-2 (paid per character), Gemini TTS (prepaid credit), Google Cloud TTS (billing), local neural voice in the browser (about 120 MB per device).
- Korean has no Kokoro voice; Korean keeps the system voice until a Korean source is chosen.

## D-022 No starter progress and no placeholder books
- Date: 2026-11-19. Decided by: owner ("remove the seed and placeholder data").
- Original choice: a first run seeded known words, learning words and one starter card per learning word for each language, and the library showed three placeholder books (Platero y yo, Don Quijote, Rotkäppchen) with invented progress.
- Now: a first run starts empty (no word states, cards or bookmarks); the library lists only the two sample books (Spanish, Korean) and books the reader imports. The sample books and their hand-written dictionary stay as demo content.
- Existing databases keep what they already stored; nothing is deleted. The `meta` table stays in the schema, unused, so no migration is needed.
- Reason: invented progress is misleading once real books are read.

## D-023 No sample books, Spanish only
- Date: 2026-11-19. Decided by: owner ("back up the two sample books, then remove them").
- Original choice: the app shipped a Spanish sample book ("La niña y el lobo") and a Korean one, with hand-written sentence notes, and the Korean book switched the active language.
- Now: the app ships no book. The library holds only books the reader imports. The two sample books and their sentence notes are removed (a copy is kept outside the repository and in git history). The hand-written Spanish dictionary stays as a lookup source.
- `Lang` is `"es"` only. The Korean pack, its styles and the language switch are removed; Korean returns together with its analyzer and an import path.
- With no book the reading screen shows an empty state that points to the library; the Words screen shows empty coverage.
- Reason: sample content is demo data, and a second language has no content once its sample book is gone.

## D-024 Gutenberg cleanup and numeral chapters on EPUB import
- Date: 2026-11-19. Decided by: owner (reported English licence text, a contents page and wrong chapter titles in an imported Gutenberg book).
- Original choice: every spine document became a chapter and every block of text became reading content.
- Now: text before the `*** START OF THE PROJECT GUTENBERG` marker and from the `*** END OF` marker onward is dropped; runs of three or more Roman-numeral-only blocks (a contents list) are dropped; when a book has at least two Roman-numeral headings, chapters start at those headings (titled `I` or `I · Subtitle`) regardless of spine files. Without markers or numeral headings the previous behaviour applies. The book title and author come from the EPUB metadata.
- Reason: the licence and contents are not the story, and its words must not be looked up as Spanish.

## D-025 Owner-only Google sign-in and multi-device sync
- Date: 2026-11-20. Decided by: owner ("do sync and accounts, I do not want data to live on one device and import again").
- Sign-in is Google only (ID token verified by the API with the public client id), restricted to the emails in `ALLOWED_EMAILS` (owner only, no public sign-up).
- Sync follows the architecture draft: client outbox, server `seq` cursor, last write wins for states, cards, bookmarks, pins, preferences and positions, append-only review log. Built book JSON (not the source EPUB) is stored in Postgres so sentence ids stay identical across devices. Sentence id ranges use random slots so offline imports on two devices do not collide. Full rules: `spec/sync.md`.
- Reason: reading and review data must follow the owner across phone and computer without importing again.

## D-026 Drop English blocks when importing a Spanish book
- Date: 2026-11-20. Decided by: owner (an imported learner book showed English copyright text and its words were looked up as Spanish).
- Original choice: every block of text of an EPUB became reading content.
- Now: when the book language is Spanish, blocks whose text is detected as English (function-word scoring, conservative) and blocks that are plain publishing front matter (copyright line, "All rights reserved", ISBN, publisher name lines) are dropped on import. Spanish blocks that contain a few English words are kept. A book with no detectable English is unchanged.
- Reason: the reader treats every word as Spanish; English summaries, glossaries and legal text would be looked up and learned as Spanish words.

## D-027 The top progress track is a read-only line without ticks or marker
- Date: 2026-11-20. Decided by: owner ("the top bar does not need to be interactive and needs no dots; with a thick book it looks bad").
- Original choice: the track showed a tick per chapter start, ticks turned filled when passed, and tapping or pressing Home/End moved to a page.
- Now: the track is a line and a progress fill only. No fern marker circle, no ticks, no tap, no keyboard handling. Chapter navigation stays in the contents drawer.
- Reason: a book with many chapters made the ticks crowd the line.

## D-028 Learner books import only their story chapters
- Date: 2026-11-20. Decided by: owner (chose "keep only the stories" for a learner book with appendices and quizzes).
- Now: when a Spanish book has paragraph-style chapter headings of the form `Capítulo N` (optionally followed by a title) or `N. Title`, chapters are built from those headings with readable titles (`1 · El detective`, prefixed by the story name when a story heading precedes it: `El Castillo · 1 · El detective`; the last chapter ends at a standalone `FIN` line). Spine documents whose first line is an appendix, glossary, quiz or answer heading (`Anexo`, `Resumen`, `Vocabulario`, `Preguntas`, `Soluciones`, `Respuestas`) are dropped. A book without such headings is unchanged.
- Reason: the quiz and glossary sections are not reading text and carry English glosses that the reader would treat as Spanish words.

## D-029 The flow renders a window of three chapters; progress is by word count
- Date: 2026-11-20. Decided by: owner ("do it", after the options and trade-offs were explained).
- Original choice: the whole book was in the DOM and pages were numbered over the whole book; progress was `page / (pages - 1)`.
- Now: the flow holds the current chapter and its neighbours; pages are numbered inside the window; progress is computed from token counts (`spec/web-reader-logic.md` §2). The sentence stays the position of record, so saved positions, bookmarks and cards are unaffected.
- Reason: on a 50 thousand word book a page turn froze for about 8 seconds and every layout change reflowed the whole book; the cost grows with the square of the DOM size.
- Amendment 2026-11-20 (owner): the contents drawer shows an estimated start page per chapter, computed from word counts and the measured words per page of the window (as in Apple Books); the number is an estimate and is recomputed on relayout.

## D-030 Chapters come from the EPUB navigation and the owner confirms them in an import preview
- Date: 2026-11-20. Decided by: owner (chose "do 1 and 2" after the D-028 rules were judged too specific to one book).
- Original choice: D-028 detected learner-book structure from book-specific headings and word lists.
- Now: `spec/import.md`. Chapters come from the EPUB `nav`/`ncx`; the heading-based rules remain only as a fallback; book-specific word lists are removed; an import preview lets the owner check which chapters to keep. This supersedes the appendix-name list of D-028.
- Reason: D-028 does not generalise to other books; the EPUB already declares its structure, and the owner is the final judge of what is reading text.

## D-031 Sign-in is required to use the app
- Date: 2026-11-20. Decided by: owner ("I want sign-in before the app can be used").
- Original choice (D-025): local-first, signed out the app behaves as before and sign-in only adds sync.
- Now: `spec/sync.md` §6.1. Without a session the app shows a sign-in gate only; with a stored session it opens at once, offline included.
- Reason: the owner wants every device tied to the account so data is never only local. The gate is a client rule: it does not protect the open lexicon and TTS endpoints.

## D-032 Words with no dictionary entry carry no word state
- Date: 2026-11-20. Decided by: owner ("do not show the new-word highlight for words with no meaning, and hide the four buttons").
- Original choice: every token had a state; a word with no meaning still showed the new-word highlight and all state and card buttons.
- Now: tokens with no entry in the lexicon forms or the static dictionary are `unmatched` (`spec/web-reader-logic.md` §3): no highlight, excluded from the counts, and the panel hides the state and card buttons. Default taken for the counts: excluded.
- Reason: names and typos cannot be studied, and the highlight and buttons suggested otherwise.
