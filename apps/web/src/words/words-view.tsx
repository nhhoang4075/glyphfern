import { coverage } from "@glyphfern/core";
import { useState } from "react";
import { indexBook } from "../app/book-index";
import { useApp } from "../app/use-app";
import { Icon } from "../icons/icon";
import { ListRow, Segmented } from "../ui";
import { CoverageRing } from "./coverage-ring";
import { type WordFilter, buildWordRows, glowClass } from "./word-list";

export function WordsView() {
  const { state, stateOf, actions } = useApp();
  const [filter, setFilter] = useState<WordFilter>("learning");
  const { book, dict } = state.pack;
  const summary = coverage(
    indexBook(book).sentences.filter((sentence) => sentence.kind === "body"),
    stateOf,
    state.cards.length,
  );
  const rows = buildWordRows(book, stateOf, filter);

  const openRow = (lemma: string, sentenceId: number) => {
    actions.requestFocus({ lemma, sentenceId });
    actions.navigate("read");
  };

  return (
    <>
      <Segmented
        className="fil"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "learning", label: "Đang học", content: <Icon name="flame" /> },
          { value: "known", label: "Đã biết", content: <Icon name="check" /> },
        ]}
      />
      <div className="wl">
        <div className="stats">
          <CoverageRing percent={summary.percent} />
          <span className="stat" aria-label="Từ mới">
            <Icon name="circle" />
            {summary.newLemmas}
          </span>
          <span className="stat lr" aria-label="Đang học">
            <Icon name="flame" />
            {summary.learningLemmas}
          </span>
          <span className="stat" aria-label="Thẻ">
            <Icon name="cards" />
            {summary.cards}
          </span>
        </div>
        {rows.length === 0 ? (
          <div className="empty">
            <Icon name={filter === "known" ? "check" : "flame"} />
          </div>
        ) : (
          rows.map((row) => (
            <ListRow
              className="wr"
              key={row.lemma}
              onClick={() => openRow(row.lemma, row.sentenceId)}
            >
              <i className={`glow ${glowClass(row.state)}`} />
              <b>{row.lemma}</b>
              <span>{dict[row.lemma]?.meaning ?? ""}</span>
            </ListRow>
          ))
        )}
      </div>
    </>
  );
}
