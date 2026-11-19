# Web reader: logic specification

Scope: client-side behaviour of `apps/web`. Server, sync and NLP are specified elsewhere. **Prototype** marks what the demo does today; **Target** marks what the product MUST do.

## 1. Data model

```
Book      { id, title, lang, chapters: Chapter[] }
Chapter   { title: Sentence(kind "title"), paragraphs: Sentence[][] }
Sentence  { id, chapter, kind: "title" | "body", tokens: Token[], vi?: string, notes?: string[] }
Token     { lead, surf, trail, lemma, group?: string, morphemes?: Morpheme[] }
Morpheme  { form: string, gloss: string }
```

- A token is the tappable unit. `lead` and `trail` are non-letter characters around `surf` (quotes, punctuation) and are not part of the tappable word.
- Tokens that share a `group` inside one sentence form a multi-token unit (for example Spanish *se fue*). Tapping any member selects the member and marks the others as group members; the panel shows the joined surface.
- `morphemes` is present for languages whose tokens contain several morphemes (none in the shipped Spanish pack). It drives the morpheme chips in the word panel.
- Chapter titles are sentences with `kind: "title"`. Their words are tappable like body words. **Prototype**: the title pseudo-sentence is built on the fly and a card created from a title word points at the first body sentence of the chapter. **Target**: titles are stored sentences with ids, so cards and bookmarks can reference them.
- Dictionary entry: `[partOfSpeech, pronunciation, meaning(vi), note?]`. Part of speech is stored spelled out in Vietnamese. **Prototype**: pronunciation is IPA for Spanish.

## 2. Pagination and position

- The page flow is one element laid out with CSS multi-column: column width = sheet width, column gap = 20% of sheet width, column fill auto. One page = one column. Step = width + gap.
- The flow holds a **window of chapters**: the current chapter, the previous one and the next one (fewer at the ends of the book). Pages are numbered inside the window only. When reading moves into another chapter the window shifts by one chapter and the layout is rebuilt anchored on the sentence on screen; jumps (contents, search, bookmarks, restored position) rebuild the window around the target sentence's chapter.
- After every layout, record for each sentence in the window the first and last page it touches (`startPage`, `endPage`) from its client rects, and record each windowed chapter's start page from its heading position.
- Reading position is a **sentence**, never a page number. After any relayout (font size, line height, font family, window resize, fullscreen toggle, fonts loaded, language switch) the app re-anchors to the sentence that was on the current page and recomputes the page.
- `layout()` MUST do nothing when the sheet has zero width (the reading view is hidden).
- Current page for position purposes: the first sentence whose `endPage >= page`.
- Book progress = `(words before the current chapter + words of the current chapter read so far) / total words`, where words are token counts from the book data and "read so far" is `(page - chapter start page) / chapter pages` inside the current chapter. It does not depend on font size and needs no layout of the rest of the book. The contents drawer shows for each chapter an estimated page number `round(words before the chapter / words per page) + 1`, where words per page is measured from the laid-out window (`window words / window pages`) and the estimate is recomputed whenever the layout changes; the current chapter shows its real page. The same rule gives the progress bar of each chapter in the contents drawer (`clamp((page - start) / chapter pages)` for the current chapter, 1 before it, 0 after it) and the progress on the book card.

## 3. Word states

Per lemma: `new` (no entry), `learning(level)` with level 1, 2 or 3 (3 is the newest), `known`.

| Action | Result |
| --- | --- |
| tap "new" button | remove the state |
| tap "learning" button | if not already learning: level 3 and play the pulse; if already learning: no change |
| tap "known" button | known |
| add a card on a word with no state | learning level 3 and pulse |
| remove a card | state unchanged |
| rate a card | the card's schedule is updated and the word state is derived from it (section 11); a word without a card never changes this way |

- Highlight strength follows level: 1 → 38% alpha, 2 → 60%, 3 → 85% of `#C2D94C`. New and known words are not highlighted.
- Every occurrence of a lemma shows its state. The state key is the **lemma**. **Target**: key is `(lang, lemma)` so lemmas of two languages can never collide. **Prototype**: key is the lemma alone and works only because the two demo languages use different scripts.
- A first run has no word states: every word is new until the reader changes it (D-022).

## 4. Coverage

`coverage = known tokens / all tokens` over the body sentences of the open book (chapter titles are excluded), as a rounded percent. The same pass counts: distinct new lemmas, distinct learning lemmas, number of cards. It is recomputed from tokens on every visit to the Words screen (no server needed).

## 5. Word panel flow

1. Tap a word: clear previous selection, mark the word selected, mark group members.
2. Look up the dictionary by lemma. Show chips: part of speech, pronunciation, lemma chip if `lemma != lowercase(surface group)`, morpheme chips if the token has morphemes.
3. Fill meaning and note, build the context sentence with the selected tokens marked.
4. Reset both reveal toggles, sync the state buttons and card button to stored state, open the panel.
5. Translate toggle shows `sentence.vi`; analysis toggle shows `sentence.notes`. Both blocks exist in the DOM at all times and animate open and closed (UI spec 3.3).
6. Closing the panel clears the selection. Turning a page, opening the drawer or Aa, or tapping outside the page closes it. The Esc key closes the panel, the drawer and the popover together; if none was open and fullscreen is on, it exits fullscreen.

## 6. Bookmarks, search, contents

- Bookmark toggle in the top bar stores the id of the first sentence on the current page. A page counts as bookmarked when any bookmarked sentence lies on it.
- Bookmarks and cards are stored **per language**: switching language swaps the active lists.
- Search is case-insensitive. A sentence matches when any token's lemma or lowercased surface equals the query or starts with it. Each result shows the sentence with matching tokens marked. Tapping a result closes the drawer and goes to the sentence page.
- Contents show for each chapter the fraction of pages behind the current page: the rule of §2: 1 for chapters before the current one, 0 for later ones, and `clamp((page - chapter start page) / chapter pages, 0, 1)` for the current one.

## 7. Page-turn engine

Applies when `turn = curl`.

**Rendering** (WebGL, fragment shader). Two textures hold the current page (front) and the next page (under), drawn from the DOM into 2D canvases by walking text nodes and per-word highlight boxes. Uniforms: page size, corner, fold direction, arc length `a`, radius `R`, paper colour.
- Fold geometry: a cylinder fold with constant radius `R = 0.6` px (effectively a crease, never a rolled tube). `a` is solved from the drag length `L` by 34 bisection steps: for `a >= pi*R` the length is `2a - pi*R`, otherwise `a - R*sin(a/R)`.
- Flap (reverse side): paper colour `x 0.985`, shade `(1 - 0.11*exp(-(t-a)/90)) * mix(0.94, 1, smoothstep(0, 25, ts))`; no transparency, no grey streaks.
- Shadow cast on the page being turned: `0.12 * exp(-(t-a)/26)` when `a > pi*R`, and `0.09 * exp(-(t-a)/24)` when `a <= pi*R`. Shadow on the page under: `0.14 * exp(-max(edge-t,0)/30)` fading to 0 across `edge-6 .. a+2`.
- Where the source falls outside the page within `3R + 10` px of the cylinder band, the gap is filled from the nearest source so no band or ribbon shows through.
- The vertical drag component is halved (`dy * 0.5`).
- DOM bookmarks and the ribbon are drawn into the texture, not layered over it.

**Input**
- Bottom-right corner turns forward, bottom-left turns back. Pointer capture on the corner element.
- Movement under 6px counts as a tap: run an automatic turn of 1250ms.
- On release: if the corner has moved farther than 30% of the book width from its start, complete the turn with a sweep of 760ms; otherwise animate back.
- The sweep end point is `[-1.3 * bw, bh]` (forward) or `[2.3 * bw, bh]` (back); y eases to the corner y with `1 - (1-t)^2.2` plus an arc `-sin(pi*t) * bh * 0.1 * (1-t)`; position uses `easeOut(k) = 1 - (1-k)^1.9`. At the end the crease is vertical and the page has fully left.
- `lostpointercapture` and `pointercancel` cancel the drag cleanly.
- After finishing, the bookmark ribbon MUST NOT replay its entrance animation (a 120ms `nort` class disables ribbon transitions).

**Fallback**: if WebGL or the shader fails at any point, switch to a DOM clip-path fold for the rest of the session. Any exception inside a tween ends the tween and restores the static page.

## 8. Reading settings

State keys: `size` 17..28 step 1 (default 21), `lh` in {1.45, 1.62, 1.85} (default 1.62), `font` in {serif, sans}, `paper` in {#FCFBF9, #F1EDE4, #1B2420}, `turn` in {slide, curl, still}, `hl` in {0, 1} (default 1).
- Choosing the night paper sets `data-night` on the root element; any other paper removes it.
- `turn = still` adds the `calm` class (durations 0.01ms).
- Size, line height and font changes trigger a relayout that keeps the current sentence.
- Highlights off adds `nohl` to the flow: level strips are removed but selected and group boxes stay.

## 9. Languages

A language is a pack: tokenizer and lemmatizer output, dictionary, TTS locale, fonts, text rules, level scale. Only Spanish is shipped (D-023); the pack boundary stays so another language can be added later.

| | Spanish (es) |
| --- | --- |
| Token unit | word |
| Pronunciation field | IPA |
| TTS locale | `es-ES` |
| Fonts | Literata, Lexend |
| Text rules | hyphenation allowed |
| Level scale | CEFR |
| Part-of-speech labels | spelled out in Vietnamese |

The active language is `es`; `data-lang="es"` is set on the root element and `lang` on the flow.

## 10. Text to speech

- Word pronunciation (panel speaker button): rate 0.88. Sentence reading (panel context button and review flip): rate 0.78. Locale from the active language.
- Speaking cancels any utterance in progress.
- A `Tts` port with two adapters (D-021): `system` (Web Speech API, the default adapter) and `server` (Kokoro neural voice synthesized by the API). The choice is the preference `voice`: `"system"` or `"server"`, default `"system"`, saved with the other preferences.
- `server` adapter: asks `GET /tts?lang=<lang>&text=<text>&speed=<rate>` (see the API README), plays the returned `audio/mpeg`, and cancels the clip in progress when a new one starts. When the API is not configured, unreachable, rate limited or answers anything but 200, it speaks the same text through the `system` adapter instead; the user sees no error.
- `speed` is the rate of the call site (0.88 word, 0.78 sentence), sent unchanged.
- No Web Speech and no audio playback: speaker buttons do nothing and raise no error.
- **Open**: local neural voice in the browser (rejected for now: about 120 MB per device) and other cloud voices (Gemini TTS needs prepaid credit, Google Cloud TTS needs billing).

## 11. Review

- Queue: all cards of the active language. A card whose lemma has no static dictionary entry shows the looked-up entry on its back, or "Chưa tra được nghĩa" when the lookup is unavailable.
- Card front: sentence with the target token blanked. Tap flips: reveals the answer, reads the sentence, enables rating.
- Ratings: 1 again (re-append to the end of the queue), 2 hard (reinsert at index min(2, length)), 3 good, 4 easy. The queue rules apply inside one session; the schedule below applies across sessions.
- Progress dots: `total` dots; done = dots before `total - queue.length`.
- Scheduling is `ts-fsrs` (decision D-020): request retention 0.9, no fuzz, default weights, default learning steps. Every card carries its FSRS data (due, stability, difficulty, state, reps, lapses, last review). A card without data is a new card due now.
- Every rating appends one entry to the review log (card, time, rating, schedule before and after). The log is never edited or deleted.
- The queue of a new review session holds the cards due now (`due <= now`) plus new cards (never reviewed) up to 10 new cards per local day.
- Word state of a lemma that has a card is derived from its schedule after each rating: never reviewed, state Learning or Relearning, or stability below 3 days: learning level 3; stability 3 to below 14 days: level 2; 14 to below 60 days: level 1; 60 days or more in state Review: known. A rating "easy" does not force known by itself. A word without a card keeps the state the user gave it.

## 12. Persistence

- **Prototype**: one `localStorage` object holds `st` (states), `bm`, `cards`, `bms` (other languages' bookmarks and cards), `pins`, `lang`, `size`, `lh`, `font`, `paper`, `turn`, `hl`. Every read and write is wrapped in try/catch; the app MUST render without it.
- **Target**: IndexedDB (Dexie) for states, cards, review log and bookmarks; the settings above in one preferences record; an outbox for sync as in the architecture document.
- A first run starts empty: no word states, cards or bookmarks (D-022).

## 13. Errors and degradation

- Missing dictionary entry: the panel shows the word and empty chips and meaning; actions still work.
- No WebGL: DOM fold. No Web Speech: speaker buttons do nothing and raise no error.
- Storage unavailable: session-only state.
- Fonts late: relayout when the font set finishes loading.

## 14. Test targets

- Pure functions (state transitions, coverage, search, chapter progress) are covered by unit tests in `packages/core`, independent of the DOM.
- Pagination re-anchoring: after changing size, the sentence on screen before and after is the same.
- First run: no book is shipped; the reading screen shows the empty state and the library offers only the add button.
- Highlights off: selection still visible. Highlights on: wipe runs once, strips end at the final geometry.
- Selection geometry: no clipping at left and right text edges, no overlap with adjacent glyphs, no size change across pulse.
