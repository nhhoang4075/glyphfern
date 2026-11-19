import type { Sentence } from "@glyphfern/core";
import { useEffect, useRef, useState } from "react";
import { Fern, Icon } from "../icons/Icon";
import type { IconName } from "../icons/iconData";
import { type ChapterRow, searchHits, sentenceText } from "./readerLogic";

export type DrawerTab = "toc" | "bookmarks" | "search";

interface DrawerProps {
  open: boolean;
  tab: DrawerTab;
  onTab: (tab: DrawerTab) => void;
  onClose: () => void;
  chapters: readonly { title: string; row: ChapterRow }[];
  bookmarks: readonly Sentence[];
  sentences: readonly Sentence[];
  onChapter: (startPage: number) => void;
  onSentence: (sentenceId: number) => void;
  onRemoveBookmark: (sentenceId: number) => void;
}

const TABS: readonly { tab: DrawerTab; icon: IconName; label: string }[] = [
  { tab: "toc", icon: "toc", label: "Mục lục" },
  { tab: "bookmarks", icon: "bookmark", label: "Đánh dấu" },
  { tab: "search", icon: "search", label: "Tìm kiếm" },
];

function Search({
  sentences,
  onSentence,
  active,
}: {
  sentences: readonly Sentence[];
  onSentence: (sentenceId: number) => void;
  active: boolean;
}) {
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const hits = searchHits(sentences, query);

  useEffect(() => {
    if (active) input.current?.focus();
  }, [active]);

  return (
    <>
      <label className="qs">
        <Icon name="search" />
        <input
          ref={input}
          type="search"
          autoComplete="off"
          aria-label="Tìm kiếm"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {query.trim() !== "" && hits.length === 0 ? (
        <div className="empty">
          <Icon name="search" />
        </div>
      ) : null}
      {hits.map((hit) => (
        <button
          type="button"
          className="hitm"
          key={hit.sentenceId}
          onClick={() => onSentence(hit.sentenceId)}
        >
          {hit.parts.map((part, index) => (
            <span key={`${index}-${part.text}`}>
              {index > 0 ? " " : ""}
              {part.marked ? <mark>{part.text}</mark> : part.text}
            </span>
          ))}
        </button>
      ))}
    </>
  );
}

export function Drawer(props: DrawerProps) {
  const { open, tab, onTab, chapters, bookmarks, onChapter, onSentence, onRemoveBookmark } = props;
  return (
    <>
      <button
        type="button"
        className={open ? "scrim on" : "scrim"}
        aria-label="Đóng"
        tabIndex={-1}
        onClick={props.onClose}
      />
      <aside className={open ? "drawer on" : "drawer"} aria-hidden={!open}>
        <div className="tabs" role="tablist">
          {TABS.map((item) => (
            <button
              type="button"
              role="tab"
              key={item.tab}
              className="tab"
              aria-label={item.label}
              aria-selected={tab === item.tab}
              onClick={() => onTab(item.tab)}
            >
              <Icon name={item.icon} />
            </button>
          ))}
        </div>
        <div className="dbody">
          {tab === "toc"
            ? chapters.map(({ title, row }) => (
                <button
                  type="button"
                  key={row.index}
                  className={row.current ? "ch cur" : "ch"}
                  onClick={() => onChapter(row.startPage)}
                >
                  <Fern className="mk" />
                  <span className="rm">
                    <b>{title}</b>
                    <span className="pr">
                      <i style={{ width: `${row.fraction * 100}%` }} />
                    </span>
                  </span>
                </button>
              ))
            : null}
          {tab === "bookmarks" ? (
            bookmarks.length === 0 ? (
              <div className="empty">
                <Icon name="bookmark" />
              </div>
            ) : (
              bookmarks.map((sentence) => (
                <div className="bm" key={sentence.id}>
                  <button type="button" className="go" onClick={() => onSentence(sentence.id)}>
                    {sentenceText(sentence)}
                  </button>
                  <button
                    type="button"
                    className="ib"
                    aria-label="Bỏ đánh dấu"
                    onClick={() => onRemoveBookmark(sentence.id)}
                  >
                    <Icon name="x" />
                  </button>
                </div>
              ))
            )
          ) : null}
          {tab === "search" ? (
            <Search sentences={props.sentences} onSentence={onSentence} active={open} />
          ) : null}
        </div>
      </aside>
    </>
  );
}
