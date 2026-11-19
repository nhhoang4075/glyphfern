import { EpubImportError, type EpubPreview } from "@glyphfern/core";
import { type ChangeEvent, useRef, useState } from "react";
import { useApp } from "../app/use-app";
import { EpubFileError, readEpubFile } from "../import/read-epub";
import { AccountRow } from "../sync/account-row";
import { Badge, Button, ConfirmDialog, IconButton } from "../ui";
import { type LibraryBook, orderBooks, userLibraryBook } from "./books";
import { CoverArt } from "./cover-art";
import { ImportPreviewDialog } from "./import-preview-dialog";

function BookCard({ book, pinned }: { book: LibraryBook; pinned: boolean }) {
  const { actions } = useApp();
  const [confirming, setConfirming] = useState(false);

  const open = async () => {
    await actions.openBook(book.id);
    actions.navigate("read");
  };

  return (
    <div className="bk" data-openable>
      <div className="cvw">
        <Button
          className="cv"
          style={{ background: `linear-gradient(160deg, ${book.colors[0]}, ${book.colors[1]})` }}
          aria-label={book.title}
          onClick={open}
        >
          <CoverArt art={book.art} />
          <b>{book.title}</b>
          <span className="pg">
            <i style={{ width: `${book.progress * 100}%` }} />
          </span>
        </Button>
        <IconButton
          variant="pin"
          active={pinned}
          icon="pin"
          label="Ghim sách"
          aria-pressed={pinned}
          onClick={() => actions.togglePin(book.id)}
        />
        {book.removable ? (
          <IconButton
            variant="pin"
            className="del"
            icon="x"
            label="Xoá sách"
            onClick={() => setConfirming(true)}
          />
        ) : null}
        <ConfirmDialog
          open={confirming}
          title={`Xoá "${book.title}" khỏi thư viện?`}
          confirmLabel="Xoá"
          cancelLabel="Huỷ"
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            actions.deleteBook(book.id);
          }}
        />
      </div>
      <div className="fl2">
        <Badge>{book.flag}</Badge>
      </div>
    </div>
  );
}

const IMPORT_ERRORS = {
  file: "Tệp này không phải EPUB hợp lệ.",
  empty: "Không đọc được nội dung chữ trong sách này.",
  other: "Không thêm được sách. Hãy thử tệp EPUB khác.",
} as const;

interface PendingImport {
  files: Readonly<Record<string, string>>;
  preview: EpubPreview;
}

function importErrorMessage(error: unknown): string {
  if (error instanceof EpubFileError) {
    return IMPORT_ERRORS.file;
  }
  if (error instanceof EpubImportError) {
    return error.reason === "empty" ? IMPORT_ERRORS.empty : IMPORT_ERRORS.file;
  }
  return IMPORT_ERRORS.other;
}

export function LibraryView() {
  const { state, actions } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const books = orderBooks(state.userBooks.map(userLibraryBook), state.pins);

  const [pending, setPending] = useState<PendingImport | null>(null);

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const files = await readEpubFile(file);
      setPending({ files, preview: actions.previewEpub(files) });
    } catch (error) {
      setMessage(importErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const confirmImport = async (chapterIds: readonly string[]) => {
    if (!pending) {
      return;
    }
    setBusy(true);
    try {
      await actions.importEpub(pending.files, chapterIds);
    } catch (error) {
      setMessage(importErrorMessage(error));
    } finally {
      setPending(null);
      setBusy(false);
    }
  };

  return (
    <>
      <AccountRow />
      <div className="shelf">
        <input
          ref={input}
          type="file"
          accept=".epub,application/epub+zip"
          hidden
          onChange={importFile}
        />
        <IconButton
          variant="add"
          icon="plus"
          label="Thêm sách"
          disabled={busy}
          onClick={() => input.current?.click()}
        />
        {message ? <output className="shelf-note">{message}</output> : null}
        {books.length === 0 ? <p className="shelf-note">Chưa có sách nào</p> : null}
        {books.map((book) => (
          <BookCard key={book.id} book={book} pinned={state.pins.includes(book.id)} />
        ))}
      </div>
      {pending ? (
        <ImportPreviewDialog
          preview={pending.preview}
          busy={busy}
          onImport={confirmImport}
          onCancel={() => setPending(null)}
        />
      ) : null}
    </>
  );
}
