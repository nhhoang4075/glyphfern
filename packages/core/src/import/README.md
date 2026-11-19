# Book import

Purpose: turn the files of an unpacked EPUB into a `Book`. Pure functions over strings; unzipping and file access live in `apps/web`.

## Flow

1. `findRootfilePath` reads `META-INF/container.xml` and returns the package file path.
2. `parseOpf` reads title, language, manifest items and spine order.
3. Spine documents with an HTML media type are resolved against the package folder (`resolveHref`).
4. `extractBlocks` turns each document into heading and paragraph blocks (inline tags dropped, entities decoded).
5. Documents with fewer than 300 characters (cover, title page) are skipped. When every document is that short, none are skipped.
6. The first block of a document becomes the chapter title when it is a heading; otherwise `fallbackTitle(n)` is used.
7. `splitSentences` (`Intl.Segmenter`) and `tokenizeSentence` produce sentences and tokens.

## Contracts

- Sentence ids are consecutive from `firstSentenceId` in reading order; the chapter title comes before its body sentences. Ids must be unique across all books of a language because bookmarks and cards store bare sentence ids.
- A token's `lemma` is its lowercase surface: no lemmatizer exists yet, so inflected forms count as separate words.
- Punctuation-only chunks attach to the previous token's `trail`, or to the next token's `lead` at the start of a sentence.

## Failure modes

`EpubImportError` with reason `container` (no root file), `package` (package file missing) or `empty` (no readable text).

## Testing

`packages/core/test/import/build-epub-book.test.ts` builds a small EPUB from strings.
