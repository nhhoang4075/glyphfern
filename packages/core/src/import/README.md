# Book import

Purpose: turn the files of an unpacked EPUB into a `Book`. Pure functions over strings; unzipping and file access live in `apps/web`.

## Flow

Two pure steps; the app puts a preview dialog between them (`spec/import.md`).

1. `parseEpubChapters(files, {lang, fallbackTitle})` returns an `EpubPreview`: title, language and `ChapterCandidate` rows (`id`, `title`, `wordCount`, `frontBackMatter`, `blocks`). It stores nothing.
2. `defaultSelectedIds(preview)` lists the rows that start checked (every row that is not front/back matter).
3. `buildBookFromChapters(preview, selectedIds, {id, lang, locale, firstSentenceId})` builds the `Book` from the selected rows only, in book order. Ids that match no row are ignored; an empty selection throws `EpubImportError("empty")`. `buildEpubBook` is parse plus the default selection (all rows when every row is front/back matter).

### Parsing

1. `findRootfilePath` reads `META-INF/container.xml`; `parseOpf` reads title, language, manifest items (with `properties`) and the spine, including non-linear itemrefs (`documents`; `spine` keeps the linear ones only).
2. Each spine HTML document except the nav document is split by `extractAnchoredBlocks` into heading and paragraph blocks plus a map from element ids (and `name` anchors) to the index of the block that contains or follows them.
3. Navigation entries come from the `nav` document's `<nav epub:type="toc">` (`parseNavDocument`); when there is no such nav, from the `toc.ncx` (`parseNcx`). Nested entries are flattened in document order. Each entry resolves to a spine document and a block index (the fragment's anchor, or the document start). Entries that do not resolve are ignored.
4. With at least two resolved entries the navigation route runs, otherwise the heading route.

### Navigation route

1. Entries are ordered by position (spine order, then block index). A chapter is every block from its entry to the next entry; blocks before the first entry belong to no chapter. Non-linear documents that no entry targets are left out.
2. `cutGutenbergBoilerplate` and, for Spanish, `dropEnglishBlocks` (`drop-english-blocks.ts`) run over the whole book, then the surviving blocks are handed back to their chapters (blocks keep their identity through the cleaning).
3. A first heading block equal to the entry label (case and accents ignored) is dropped so the title is not repeated. Chapters without words are skipped. The title is the label, trimmed; an empty label uses `fallbackTitle(n)`.
4. `frontBackMatter` is true when the target document is non-linear, when the entry, the document's `body` or first `section`, or the element carrying the fragment has an `epub:type` of `frontmatter`, `backmatter`, `toc`, `copyright-page`, `titlepage`, `index`, `glossary`, `appendix`, `bibliography` or `acknowledgments`, or when the target document has fewer than 150 words after step 2. No book-specific names are used.

### Heading route (fallback)

1. `cutGutenbergBoilerplate`, `dropContentsRuns` (runs of three or more Roman-numeral-only blocks, `-I-,`) and, for Spanish, `dropEnglishBlocks`.
2. `splitByChapterHeadings` (`paragraph-chapters.ts`): a short paragraph (80 characters or fewer) matching `Capítulo N` (case and accent insensitive, optional separator `– — - : .` and optional title) starts a chapter titled `N · Title` or `N`. Active only with at least two such blocks; blocks before the first heading are dropped.
3. Else `splitByNumeralHeadings` (`chapter-headings.ts`): a heading such as `-I-` or `II. Title` (or a paragraph that is only a dash-wrapped numeral) starts a chapter titled `I` or `I · Subtitle`; needs at least two; text before the first heading is dropped unless it has 300 or more characters.
4. Else each spine document is a chapter: documents with fewer than 300 characters are skipped, unless all are that short. The first block becomes the title when it is a heading, otherwise `fallbackTitle(n)`.
5. No row is front/back matter in this route.

### English-block detection

`dropEnglishBlocks` scores each block by common English function words against common Spanish function words plus Spanish-only letters (`ñ á é í ó ú ü ¿ ¡`). A block is English when it has at least two English words and more than twice as many Spanish points. A glossary entry `word = gloss` is scored on the text before ` = `. The story span runs from the first to the last clearly Spanish prose block (six or more words, at least three Spanish points, English points below half); outside it, publishing lines (copyright, "All rights reserved", ISBN, a publisher name) and blocks with an English word and no Spanish point are dropped too. Documents left empty disappear.

### Sentences

`splitSentences` (`Intl.Segmenter`) and `tokenizeSentence` produce sentences and tokens; the chapter title is the first sentence of its chapter.

## Contracts

- Sentence ids are consecutive from `firstSentenceId` in reading order; the chapter title comes before its body sentences. Ids must be unique across all books of a language because bookmarks and cards store bare sentence ids.
- A token's `lemma` is its lowercase surface: no lemmatizer exists yet, so inflected forms count as separate words.
- Punctuation-only chunks attach to the previous token's `trail`, or to the next token's `lead` at the start of a sentence.

## Failure modes

`EpubImportError` with reason `container` (no root file), `package` (package file missing) or `empty` (no readable text, or no selected chapter with text).

## Testing

`packages/core/test/import/navigation-chapters.test.ts` builds small EPUBs from strings (nav and ncx variants) and covers navigation parsing, fragment targets, classification, fallback, default selection and the built book. `heading-fallback.test.ts` covers `Capítulo N` splitting. `gutenberg-cleanup.test.ts`, `drop-english-blocks.test.ts` and `build-epub-book.test.ts` cover the cleaning steps and sentence building; checks on real books run only when `SHORT_STORIES_DIR` or `MARIANELA_DIR` point at unzipped folders.
