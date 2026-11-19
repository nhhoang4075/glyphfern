import { useApp } from "../app/useApp";
import { Icon } from "../icons/Icon";
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
        <button
          type="button"
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
        </button>
        <button
          type="button"
          className={pinned ? "pin on" : "pin"}
          aria-label="Ghim sách"
          aria-pressed={pinned}
          onClick={() => actions.togglePin(book.id)}
        >
          <Icon name="pin" />
        </button>
      </div>
      <div className="fl2">
        <span className="flag">{book.flag}</span>
      </div>
    </div>
  );
}

export function LibraryView() {
  const { state } = useApp();
  const books = orderBooks(LIBRARY_BOOKS, state.pins);
  return (
    <div className="shelf">
      <button type="button" className="add" aria-label="Thêm sách">
        <Icon name="plus" />
      </button>
      {books.map((book) => (
        <BookCard key={book.id} book={book} pinned={state.pins.includes(book.id)} />
      ))}
    </div>
  );
}
