# Book import (EPUB)

## 1. Chapter source

- The structural source of chapters is the EPUB's own navigation: the EPUB 3 `nav` document (`<nav epub:type="toc">`) or, when absent, the EPUB 2 `toc.ncx`. Each navigation entry points to a spine document and optionally a fragment id inside it.
- A chapter is the run of content from its entry's target to the next entry's target (spine order). Chapter title = the entry label, trimmed.
- Entries are classified from the label only by language-independent structure, never by book-specific names: an entry is a **candidate front/back matter** when it is a navigation entry whose target document contains fewer than 150 tokens, or when it is marked in the EPUB as non-linear or with `epub:type` of `frontmatter`, `backmatter`, `toc`, `copyright-page`, `titlepage`, `index`, `glossary`, `appendix`, `bibliography` or `acknowledgments`.
- When the EPUB has no usable navigation (no `nav`/`ncx`, or fewer than 2 entries resolving to spine documents), the existing heading-based splitting is used as the fallback (Gutenberg cleanup, `Capítulo N` and numeral headings, one chapter per spine document). Book-specific word lists (`Anexo`, `Vocabulario`, `Preguntas`…) are removed.
- The Gutenberg boilerplate cut and the English-block drop (D-026) still apply to the text of every chapter.

## 2. Import preview

- After the file is parsed and before anything is stored, the app shows a preview: the book title, language, and one row per chapter with a checkbox, the chapter title and its word count.
- Candidate front/back matter rows start unchecked; all other rows start checked. The owner can check or uncheck any row. At least one row must stay checked; the import button is disabled otherwise.
- The import button builds the book from the checked chapters only, in book order. A cancel button leaves nothing stored.
- Language is the existing detected or chosen language; the preview shows it and does not change how it is chosen.
- The preview is an in-app dialog (never a native dialog) and follows the existing UI conventions; it is keyboard accessible.

## 3. Tests

- Navigation parsing for `nav` and `ncx`, fragment targets, fallback to headings when navigation is missing, classification of candidate front/back matter by structure, preview selection rules (default checks, at least one checked), and the built book containing exactly the checked chapters. Test values come from small synthetic EPUBs built in the test.
