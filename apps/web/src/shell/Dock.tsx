import { ROUTES, type Route } from "../app/api";
import { useApp } from "../app/useApp";
import { Fern, Icon } from "../icons/Icon";
import type { IconName } from "../icons/iconData";

const DOCK_ITEMS: Record<Route, { icon: IconName; label: string }> = {
  library: { icon: "shelf", label: "Thư viện" },
  read: { icon: "book", label: "Đọc sách" },
  words: { icon: "words", label: "Từ vựng" },
  review: { icon: "cards", label: "Ôn tập" },
};

export function Dock() {
  const { state, actions } = useApp();
  return (
    <nav className="dock" aria-label="Glyphfern">
      <Fern className="logo" />
      {ROUTES.map((route) => (
        <button
          type="button"
          key={route}
          className="dk"
          aria-label={DOCK_ITEMS[route].label}
          aria-current={state.route === route ? "page" : undefined}
          onClick={() => actions.navigate(route)}
        >
          <Icon name={DOCK_ITEMS[route].icon} />
        </button>
      ))}
      <span className="sp" />
    </nav>
  );
}
