import { useMemo } from "react";
import { FERN_MARKUP, ICON_MARKUP, type IconName } from "./iconData";
import { parseMarkup, renderNodes } from "./markup";

export function Icon({ name, className }: { name: IconName; className?: string }) {
  const children = useMemo(() => renderNodes(parseMarkup(ICON_MARKUP[name])), [name]);
  return (
    <svg
      className={className ? `ic ${className}` : "ic"}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function Fern({ className }: { className?: string }) {
  const children = useMemo(() => renderNodes(parseMarkup(FERN_MARKUP)), []);
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}
