import type { ComponentPropsWithoutRef } from "react";
import { cx } from "./cx";

export interface PopoverProps extends ComponentPropsWithoutRef<"div"> {
  open: boolean;
}

export function Popover({ open, className, ...rest }: PopoverProps) {
  return <div {...rest} className={cx("pop", className)} hidden={!open} aria-hidden={!open} />;
}
