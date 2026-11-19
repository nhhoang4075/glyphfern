import { progressRatio } from "@glyphfern/ui";
import { type Ref, useLayoutEffect, useRef, useState } from "react";
import { Fern, Icon } from "../icons/Icon";
import { type TrackTick, seekPage, trackTicks } from "./track";

interface TopBarProps {
  aaRef: Ref<HTMLButtonElement>;
  shown: boolean;
  page: number;
  pages: number;
  chapterStarts: readonly number[];
  bookmarked: boolean;
  fullscreen: boolean;
  onContents: () => void;
  onSeek: (page: number) => void;
  onBookmark: () => void;
  onType: () => void;
  onFullscreen: () => void;
  onPointerMove: () => void;
}

export function TopBar(props: TopBarProps) {
  const track = useRef<HTMLDivElement>(null);
  const [innerWidth, setInnerWidth] = useState(0);

  useLayoutEffect(() => {
    const element = track.current;
    if (!element) return;
    const measure = () => setInnerWidth(element.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const fraction = progressRatio(props.page, props.pages);
  const ticks: TrackTick[] = trackTicks(props.chapterStarts, props.page, props.pages, innerWidth);

  const seek = (clientX: number) => {
    const rect = track.current?.getBoundingClientRect();
    if (!rect) return;
    props.onSeek(seekPage(clientX, rect.left, rect.width, props.pages));
  };

  return (
    <div className={props.shown ? "bar show" : "bar"} onPointerMove={props.onPointerMove}>
      <button type="button" className="ib" aria-label="Mục lục" onClick={props.onContents}>
        <Icon name="toc" />
      </button>
      <div
        className="track"
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label="Tiến độ"
        aria-valuemin={0}
        aria-valuemax={Math.max(0, props.pages - 1)}
        aria-valuenow={props.page}
        onClick={(event) => seek(event.clientX)}
        onKeyDown={(event) => {
          if (event.key === "Home") props.onSeek(0);
          else if (event.key === "End") props.onSeek(props.pages - 1);
        }}
      >
        <div className="ln" />
        {ticks.map((tick) => (
          <i
            key={tick.chapter}
            className={tick.done ? "tk done" : "tk"}
            style={{ left: `${tick.fraction * 100}%` }}
          />
        ))}
        <span className="mo" style={{ left: `${fraction * 100}%` }}>
          <Fern />
        </span>
      </div>
      <button
        type="button"
        className={props.bookmarked ? "ib on" : "ib"}
        aria-label="Đánh dấu trang"
        aria-pressed={props.bookmarked}
        onClick={props.onBookmark}
      >
        {props.bookmarked ? <Icon name="bookmark" className="fill" /> : <Icon name="bookmark" />}
      </button>
      <button
        type="button"
        className="ib"
        aria-label="Chữ và giấy"
        data-aa=""
        ref={props.aaRef}
        onClick={props.onType}
      >
        <Icon name="aa" />
      </button>
      <button
        type="button"
        className="ib"
        aria-label={props.fullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
        onClick={props.onFullscreen}
      >
        <Icon name={props.fullscreen ? "shrink" : "expand"} />
      </button>
    </div>
  );
}
