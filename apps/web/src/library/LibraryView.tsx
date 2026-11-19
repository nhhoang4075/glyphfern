import { useApp } from "../app/useApp";
import { Badge, Button, IconButton } from "../ui";
import { CoverArt } from "./CoverArt";
import { LIBRARY_BOOKS, type LibraryBook, orderBooks } from "./books";

function BookCard({ book, pinned }: { book: LibraryBook; pinned: boolean }) {
  const { actions } = useApp();
  const openable = book.lang !== null;

  const open = async () => {
    if (book.lang === null) {
      return;
    }
    await actions.switchLanguage(book.lang);
    actions.navigate("read");
  };

  return (
    <div className="bk" data-openable={openable}>
      <div className="cvw">
        <Button
          className="cv"
          style={{ background: `linear-gradient(160deg, ${book.colors[0]}, ${book.colors[1]})` }}
          aria-label={book.title}
          aria-disabled={!openable}
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
      </div>
      <div className="fl2">
        <Badge>{book.flag}</Badge>
      </div>
    </div>
  );
}

export function LibraryView() {
  const { state } = useApp();
  const books = orderBooks(LIBRARY_BOOKS, state.pins);
  return (
    <div className="shelf">
      <IconButton variant="add" icon="plus" label="Thêm sách" />
      {books.map((book) => (
        <BookCard key={book.id} book={book} pinned={state.pins.includes(book.id)} />
      ))}
    </div>
  );
}
