import { EpubImportError } from "@glyphfern/core";
import { type ChangeEvent, useRef, useState } from "react";
import { useApp } from "../app/use-app";
import { EpubFileError, readEpubFile } from "../import/read-epub";
import { Badge, Button, IconButton } from "../ui";
import { type LibraryBook, orderBooks, userLibraryBook } from "./books";
import { CoverArt } from "./cover-art";

function BookCard({ book, pinned }: { book: LibraryBook; pinned: boolean }) {
  const { actions } = useApp();

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
            onClick={() => {
              if (window.confirm(`Xoá "${book.title}" khỏi thư viện?`)) {
                actions.deleteBook(book.id);
              }
            }}
          />
        ) : null}
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

export function LibraryView() {
  const { state, actions } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const books = orderBooks(state.userBooks.map(userLibraryBook), state.pins);

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await actions.importEpub(await readEpubFile(file));
    } catch (error) {
      if (error instanceof EpubFileError) {
        setMessage(IMPORT_ERRORS.file);
      } else if (error instanceof EpubImportError) {
        setMessage(error.reason === "empty" ? IMPORT_ERRORS.empty : IMPORT_ERRORS.file);
      } else {
        setMessage(IMPORT_ERRORS.other);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
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
  );
}
