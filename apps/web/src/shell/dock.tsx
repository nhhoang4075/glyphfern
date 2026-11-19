import { ROUTES, type Route } from "../app/api";
import { useApp } from "../app/use-app";
import { Fern } from "../icons/icon";
import type { IconName } from "../icons/icon-data";
import { hasLearningWord } from "../reader/reader-logic";
import { IconButton } from "../ui";

const DOCK_ITEMS: Record<Route, { icon: IconName; label: string }> = {
  library: { icon: "shelf", label: "Thư viện" },
  read: { icon: "book", label: "Đọc sách" },
  words: { icon: "words", label: "Từ vựng" },
  review: { icon: "cards", label: "Ôn tập" },
};

export function Dock() {
  const { state, actions } = useApp();
  const learning = hasLearningWord(state.wordStates);
  return (
    <nav className="dock" aria-label="Glyphfern">
      <Fern className="logo" />
      {ROUTES.map((route) => (
        <IconButton
          key={route}
          variant="dk"
          data-route={route}
          icon={DOCK_ITEMS[route].icon}
          label={DOCK_ITEMS[route].label}
          aria-current={state.route === route ? "page" : undefined}
          onClick={() => actions.navigate(route)}
        >
          {route === "words" && learning ? <i className="dot" /> : null}
        </IconButton>
      ))}
      <span className="sp" />
    </nav>
  );
}
