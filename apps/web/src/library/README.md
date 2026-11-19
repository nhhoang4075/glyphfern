# library

## Purpose

The Library screen: the shelf of imported books, pinning, deletion and EPUB import.

## Flow

1. The add button opens a file chooser; the file is unzipped (`import/read-epub.ts`) and `actions.previewEpub` parses it. Nothing is stored yet.
2. `ImportPreviewDialog` (`import-preview-dialog.tsx`) opens as a native modal `dialog` (same `.cfm` base as `ConfirmDialog`, extra `.ipv` classes in `styles/library.css`). It shows the book title, the language and one row per chapter: a checkbox, the title and the word count. Rows flagged `frontBackMatter` start unchecked and carry a small tag; every other row starts checked.
3. Rows are native checkboxes inside labels, so Tab, Space and screen readers work without extra code. Escape or the cancel button closes the dialog and stores nothing.
4. The import button is disabled while no row is checked or while an import runs. It calls `actions.importEpub(files, checkedIds)` with the checked ids in book order; the dialog closes when the import ends.

## Failure modes

A file that cannot be unzipped, a package without a root file or a book with no readable text shows a note on the shelf and opens no dialog. An import that fails after confirmation shows the same kind of note.

## Testing

Selection rules and the built book are covered in `packages/core/test/import/navigation-chapters.test.ts`; `apps/web/test/app/books.test.ts` covers `previewEpub` and `importEpub` with chosen ids.
