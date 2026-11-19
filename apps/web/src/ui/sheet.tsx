import type { ComponentPropsWithoutRef } from "react";
import { cx } from "./cx";

export interface SheetProps extends ComponentPropsWithoutRef<"div"> {
  open: boolean;
  variant: "side" | "dock";
}

export function Sheet({ open, variant, className, children, ...rest }: SheetProps) {
  if (variant === "side") {
    return (
      <aside {...rest} className={cx("drawer", className, open && "on")} aria-hidden={!open}>
        {children}
      </aside>
    );
  }
  return (
    <div {...rest} className={cx("panel", className)} hidden={!open} aria-hidden={!open}>
      {children}
    </div>
  );
}
