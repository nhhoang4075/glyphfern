import type { ComponentPropsWithoutRef } from "react";
import { Button, type ButtonProps } from "./button";

export type ListRowProps =
  | ({ as?: "button" } & ButtonProps)
  | ({ as: "div" } & ComponentPropsWithoutRef<"div">);

export function ListRow(props: ListRowProps) {
  if (props.as === "div") {
    const { as: _as, ...rest } = props;
    return <div {...rest} />;
  }
  const { as: _as, ...rest } = props;
  return <Button {...rest} />;
}
