import type { ComponentPropsWithoutRef } from "react";
import { cx } from "./cx";

export function Badge({ className, ...rest }: ComponentPropsWithoutRef<"span">) {
  return <span {...rest} className={cx("badge", className)} />;
}
