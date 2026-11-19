# Book import

Purpose: turn the files of an unpacked EPUB into a `Book`. Pure functions over strings; unzipping and file access live in `apps/web`.

## Flow

1. `findRootfilePath` reads `META-INF/container.xml` and returns the package file path.
2. `parseOpf` reads title, language, manifest items and spine order.
3. Spine documents with an HTML media type are resolved against the package folder (`resolveHref`).
4. `extractBlocks` turns each document into heading and paragraph blocks (inline tags dropped, entities decoded).
5. `cutGutenbergBoilerplate` drops every block up to and including a `*** START OF THE PROJECT GUTENBERG` marker and from a `*** END OF THE PROJECT GUTENBERG` marker onward. A missing marker leaves that side untouched. `dropContentsRuns` removes runs of three or more Roman-numeral-only blocks (`-I-,`, `-II-,`), which is a table of contents.
6. When the book language is Spanish, `dropEnglishBlocks` (`drop-english-blocks.ts`) removes English blocks across all documents:
   - Each block is scored by counting common English function words and common Spanish function words plus Spanish-only letters (`ñ á é í ó ú ü ¿ ¡`). A block is English when it has at least two English words and more than twice as many Spanish points. Spanish prose with a few English words, dialogue lines and short Spanish headings stay.
   - A glossary entry `word = gloss` is scored on the text before ` = `, so every entry of a glossary is treated alike.
   - The story span runs from the first to the last block that is clearly Spanish prose (six or more words, at least three Spanish points, English points below half of them). Outside that span, publishing lines (copyright, "All rights reserved", ISBN, a line that is only a publisher name) and blocks with any English function word and no Spanish point are dropped as well. Inside the span only the score decides.
   - Documents left empty disappear, and a chapter whose body ends up empty is skipped, so no empty chapter appears.
7. `dropAppendixDocuments` (`drop-appendix-documents.ts`) removes spine documents whose first block, folded to lowercase without accents, starts with `anexo(s)`, `resumen`, `vocabulario`, `preguntas`, `soluciones` or `respuestas` (a glossary, quiz or answer sheet of a learner book). It acts only when the book has chapter headings (step 8).
8. `splitByChapterHeadings` (`paragraph-chapters.ts`) handles paragraph-style headings of learner books. A short paragraph block (80 characters or fewer) matching `Capítulo N` (case and accent insensitive, optional separator `– — - : .` and optional title) starts a chapter. The step is active only when at least two such blocks exist. A story heading, `N. Title` or a lone `N.` followed by a title line, counts only when a chapter heading follows it directly; it is not a chapter itself and its title prefixes every chapter until the next story heading. Chapter titles are `Story · N · Title`, `N · Title`, `N`, with the story part only when a story heading was seen. Blocks before the first chapter heading are dropped, and the last chapter ends at a standalone `FIN` block, so publisher text around the stories does not enter the book.
9. `splitByNumeralHeadings` joins the cleaned blocks of all documents and starts a chapter at each Roman-numeral heading: a heading block such as `-I-` or `II. Title` (subtitle may come from the same heading across a `<br>`), or a paragraph that is only a dash-wrapped numeral. The chapter title is `I` or `I · Subtitle`. It applies only when at least two such headings exist. Text before the first heading is dropped unless it holds 300 or more characters, in which case it becomes a chapter with the fallback title.
10. Otherwise each spine document is a chapter: documents with fewer than 300 characters (cover, title page) are skipped, unless all are that short. The first block becomes the chapter title when it is a heading; otherwise `fallbackTitle(n)` is used.
11. `splitSentences` (`Intl.Segmenter`) and `tokenizeSentence` produce sentences and tokens.

## Contracts

- Sentence ids are consecutive from `firstSentenceId` in reading order; the chapter title comes before its body sentences. Ids must be unique across all books of a language because bookmarks and cards store bare sentence ids.
- A token's `lemma` is its lowercase surface: no lemmatizer exists yet, so inflected forms count as separate words.
- Punctuation-only chunks attach to the previous token's `trail`, or to the next token's `lead` at the start of a sentence.

## Failure modes

`EpubImportError` with reason `container` (no root file), `package` (package file missing) or `empty` (no readable text).

## Testing

`packages/core/test/import/build-epub-book.test.ts` builds a small EPUB from strings. `drop-english-blocks.test.ts` covers the detector and the front matter rule with synthetic fixtures, plus checks on a real learner book (`SHORT_STORIES_DIR`) and on Marianela (`MARIANELA_DIR`) that are skipped without the unzipped folders. `learner-book-chapters.test.ts` covers chapter headings, appendix documents and the books that must stay unchanged, with synthetic fixtures, plus real checks on a learner book (`SHORT_STORIES_DIR`, 24 chapters) and on Marianela (`MARIANELA_DIR`, 22 chapters and 3535 sentences) that are skipped without the unzipped folders. `gutenberg-cleanup.test.ts` covers boilerplate, contents and heading splitting with synthetic fixtures, plus a check on the real Marianela EPUB when `MARIANELA_DIR` points at its unzipped folder (skipped otherwise).
