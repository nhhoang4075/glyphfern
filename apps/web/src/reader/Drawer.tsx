import type { Sentence } from "@glyphfern/core";
import { useEffect, useRef, useState } from "react";
import { Fern, Icon } from "../icons/Icon";
import type { IconName } from "../icons/iconData";
import { Button, IconButton, ListRow, Scrim, Segmented, Sheet } from "../ui";
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
        <ListRow className="hitm" key={hit.sentenceId} onClick={() => onSentence(hit.sentenceId)}>
          {hit.parts.map((part, index) => (
            <span key={`${index}-${part.text}`}>
              {index > 0 ? " " : ""}
              {part.marked ? <mark>{part.text}</mark> : part.text}
            </span>
          ))}
        </ListRow>
      ))}
    </>
  );
}

export function Drawer(props: DrawerProps) {
  const { open, tab, onTab, chapters, bookmarks, onChapter, onSentence, onRemoveBookmark } = props;
  return (
    <>
      <Scrim open={open} label="Đóng" onClose={props.onClose} />
      <Sheet variant="side" open={open}>
        <Segmented
          className="tabs"
          semantics="tab"
          optionClassName="tab"
          value={tab}
          onChange={onTab}
          options={TABS.map((item) => ({
            value: item.tab,
            label: item.label,
            content: <Icon name={item.icon} />,
          }))}
        />
        <div className="dbody">
          {tab === "toc"
            ? chapters.map(({ title, row }) => (
                <ListRow
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
                </ListRow>
              ))
            : null}
          {tab === "bookmarks" ? (
            bookmarks.length === 0 ? (
              <div className="empty">
                <Icon name="bookmark" />
              </div>
            ) : (
              bookmarks.map((sentence) => (
                <ListRow as="div" className="bm" key={sentence.id}>
                  <Button className="go" onClick={() => onSentence(sentence.id)}>
                    {sentenceText(sentence)}
                  </Button>
                  <IconButton
                    icon="x"
                    label="Bỏ đánh dấu"
                    onClick={() => onRemoveBookmark(sentence.id)}
                  />
                </ListRow>
              ))
            )
          ) : null}
          {tab === "search" ? (
            <Search sentences={props.sentences} onSentence={onSentence} active={open} />
          ) : null}
        </div>
      </Sheet>
    </>
  );
}
