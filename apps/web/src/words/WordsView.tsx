import { coverage } from "@glyphfern/core";
import { useState } from "react";
import { indexBook } from "../app/bookIndex";
import { useApp } from "../app/useApp";
import { Icon } from "../icons/Icon";
import { CoverageRing } from "./CoverageRing";
import { type WordFilter, buildWordRows, glowClass } from "./wordList";

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
      <div className="fil">
        <button
          type="button"
          aria-label="Đang học"
          aria-pressed={filter === "learning"}
          onClick={() => setFilter("learning")}
        >
          <Icon name="flame" />
        </button>
        <button
          type="button"
          aria-label="Đã biết"
          aria-pressed={filter === "known"}
          onClick={() => setFilter("known")}
        >
          <Icon name="check" />
        </button>
      </div>
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
            <button
              type="button"
              className="wr"
              key={row.lemma}
              onClick={() => openRow(row.lemma, row.sentenceId)}
            >
              <i className={`glow ${glowClass(row.state)}`} />
              <b>{row.lemma}</b>
              <span>{dict[row.lemma]?.meaning ?? ""}</span>
            </button>
          ))
        )}
      </div>
    </>
  );
}
