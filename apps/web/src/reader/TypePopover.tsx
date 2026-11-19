import type { CSSProperties } from "react";
import type { FontKey, LineHeight, PaperColor, TurnStyle } from "../app/api";
import { MAX_SIZE, MIN_SIZE } from "../app/defaults";
import { useApp } from "../app/useApp";
import { Icon } from "../icons/Icon";
import type { IconName } from "../icons/iconData";
import { Popover, Segmented, Slider } from "../ui";

interface TypePopoverProps {
  open: boolean;
  placement: { right: number; top: number };
}

const LINE_HEIGHTS: readonly { value: LineHeight; icon: IconName; label: string }[] = [
  { value: 1.45, icon: "lh1", label: "Dòng sát" },
  { value: 1.62, icon: "lh2", label: "Dòng vừa" },
  { value: 1.85, icon: "lh3", label: "Dòng thưa" },
];

const TURN_STYLES: readonly { value: TurnStyle; icon: IconName; label: string }[] = [
  { value: "slide", icon: "slide", label: "Trượt" },
  { value: "curl", icon: "curl", label: "Lật trang" },
  { value: "still", icon: "still", label: "Tĩnh" },
];

const HIGHLIGHTS: readonly { value: 0 | 1; icon: IconName; label: string }[] = [
  { value: 1, icon: "hlOn", label: "Bật tô sáng" },
  { value: 0, icon: "hlOff", label: "Tắt tô sáng" },
];

const FONTS: readonly { value: FontKey; label: string }[] = [
  { value: "serif", label: "Chữ có chân" },
  { value: "sans", label: "Chữ không chân" },
];

const PAPERS: readonly { value: PaperColor; label: string }[] = [
  { value: "#FCFBF9", label: "Giấy trắng" },
  { value: "#F1EDE4", label: "Giấy kem" },
  { value: "#1B2420", label: "Đêm" },
];

export function TypePopover({ open, placement }: TypePopoverProps) {
  const { state, actions } = useApp();
  const { preferences } = state;
  const style: CSSProperties = { right: placement.right, top: placement.top, left: "auto" };

  return (
    <Popover open={open} style={style}>
      <div className="row">
        <span className="a1">A</span>
        <Slider
          min={MIN_SIZE}
          max={MAX_SIZE}
          value={preferences.size}
          label="Cỡ chữ"
          onChange={(size) => actions.setPreference("size", size)}
        />
        <span className="a2">A</span>
      </div>
      <Segmented
        className="row seg"
        value={preferences.lh}
        onChange={(value) => actions.setPreference("lh", value)}
        options={LINE_HEIGHTS.map((item) => ({
          value: item.value,
          label: item.label,
          content: <Icon name={item.icon} />,
        }))}
      />
      <Segmented
        className="row seg"
        value={preferences.hl}
        onChange={(value) => actions.setPreference("hl", value)}
        options={HIGHLIGHTS.map((item) => ({
          value: item.value,
          label: item.label,
          content: <Icon name={item.icon} />,
        }))}
      />
      <Segmented
        className="row seg"
        value={preferences.turn}
        onChange={(value) => actions.setPreference("turn", value)}
        options={TURN_STYLES.map((item) => ({
          value: item.value,
          label: item.label,
          content: <Icon name={item.icon} />,
        }))}
      />
      <Segmented
        className="row seg"
        value={preferences.font}
        onChange={(value) => actions.setPreference("font", value)}
        options={FONTS.map((item) => ({
          value: item.value,
          label: item.label,
          content: <span className={item.value === "serif" ? "f1" : "f2"}>Ag</span>,
        }))}
      />
      <Segmented
        className="row seg"
        value={preferences.paper}
        onChange={(value) => actions.setPreference("paper", value)}
        options={PAPERS.map((item) => ({
          value: item.value,
          label: item.label,
          content: <i className="sw" style={{ background: item.value }} />,
        }))}
      />
    </Popover>
  );
}
