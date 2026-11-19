import { progressRatio } from "@glyphfern/ui";
import type { Ref } from "react";
import { IconButton } from "../ui";

interface TopBarProps {
  aaRef: Ref<HTMLButtonElement>;
  shown: boolean;
  page: number;
  pages: number;
  bookmarked: boolean;
  fullscreen: boolean;
  onContents: () => void;
  onBookmark: () => void;
  onType: () => void;
  onFullscreen: () => void;
  onPointerMove: () => void;
}

export function TopBar(props: TopBarProps) {
  const fraction = progressRatio(props.page, props.pages);

  return (
    <div className={props.shown ? "bar show" : "bar"} onPointerMove={props.onPointerMove}>
      <IconButton icon="toc" label="Mục lục" onClick={props.onContents} />
      <div className="track" aria-hidden="true">
        <div className="ln" />
        <div className="fl" style={{ width: `${fraction * 100}%` }} />
      </div>
      <IconButton
        icon="bookmark"
        label="Đánh dấu trang"
        active={props.bookmarked}
        iconClassName={props.bookmarked ? "fill" : undefined}
        aria-pressed={props.bookmarked}
        onClick={props.onBookmark}
      />
      <IconButton
        icon="aa"
        label="Chữ và giấy"
        data-aa=""
        ref={props.aaRef}
        onClick={props.onType}
      />
      <IconButton
        icon={props.fullscreen ? "shrink" : "expand"}
        label={props.fullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
        onClick={props.onFullscreen}
      />
    </div>
  );
}
