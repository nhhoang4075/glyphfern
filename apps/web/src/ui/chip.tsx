import type { ComponentPropsWithoutRef } from "react";
import { cx } from "./cx";

export function Chip({ className, ...rest }: ComponentPropsWithoutRef<"span">) {
  return <span {...rest} className={cx("chip", className)} />;
}
