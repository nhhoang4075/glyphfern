import type { CSSProperties } from "react";
import type { FontKey, LineHeight, PaperColor, TurnStyle } from "../app/api";
import { MAX_SIZE, MIN_SIZE } from "../app/defaults";
import { useApp } from "../app/useApp";
import { Icon } from "../icons/Icon";
import type { IconName } from "../icons/iconData";

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
    <div className="pop" hidden={!open} aria-hidden={!open} style={style}>
      <div className="row">
        <span className="a1">A</span>
        <input
          type="range"
          min={MIN_SIZE}
          max={MAX_SIZE}
          step={1}
          value={preferences.size}
          aria-label="Cỡ chữ"
          onChange={(event) => actions.setPreference("size", Number(event.target.value))}
        />
        <span className="a2">A</span>
      </div>
      <div className="row seg">
        {LINE_HEIGHTS.map((item) => (
          <button
            type="button"
            key={item.value}
            aria-label={item.label}
            aria-pressed={preferences.lh === item.value}
            onClick={() => actions.setPreference("lh", item.value)}
          >
            <Icon name={item.icon} />
          </button>
        ))}
      </div>
      <div className="row seg">
        {HIGHLIGHTS.map((item) => (
          <button
            type="button"
            key={item.value}
            aria-label={item.label}
            aria-pressed={preferences.hl === item.value}
            onClick={() => actions.setPreference("hl", item.value)}
          >
            <Icon name={item.icon} />
          </button>
        ))}
      </div>
      <div className="row seg">
        {TURN_STYLES.map((item) => (
          <button
            type="button"
            key={item.value}
            aria-label={item.label}
            aria-pressed={preferences.turn === item.value}
            onClick={() => actions.setPreference("turn", item.value)}
          >
            <Icon name={item.icon} />
          </button>
        ))}
      </div>
      <div className="row seg">
        {FONTS.map((item) => (
          <button
            type="button"
            key={item.value}
            aria-label={item.label}
            aria-pressed={preferences.font === item.value}
            onClick={() => actions.setPreference("font", item.value)}
          >
            <span className={item.value === "serif" ? "f1" : "f2"}>Ag</span>
          </button>
        ))}
      </div>
      <div className="row seg">
        {PAPERS.map((item) => (
          <button
            type="button"
            key={item.value}
            aria-label={item.label}
            aria-pressed={preferences.paper === item.value}
            onClick={() => actions.setPreference("paper", item.value)}
          >
            <i className="sw" style={{ background: item.value }} />
          </button>
        ))}
      </div>
    </div>
  );
}
