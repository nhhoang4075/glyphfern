import type { ComponentPropsWithRef } from "react";

export type ButtonProps = ComponentPropsWithRef<"button">;

export function Button({ type = "button", ...rest }: ButtonProps) {
  return <button type={type} {...rest} />;
}
