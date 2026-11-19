import type { ReactNode } from "react";
import { Icon } from "../icons/Icon";
import type { IconName } from "../icons/iconData";
import { Button, type ButtonProps } from "./button";
import { cx } from "./cx";

export type IconButtonVariant = "ib" | "sm" | "st" | "hit" | "pin" | "add" | "dk";

export interface IconButtonProps extends Omit<ButtonProps, "aria-label" | "children"> {
  icon: IconName;
  label: string;
  variant?: IconButtonVariant | null;
  active?: boolean;
  iconClassName?: string | undefined;
  children?: ReactNode;
}

export function IconButton({
  icon,
  label,
  variant = "ib",
  active = false,
  iconClassName,
  className,
  children,
  ...rest
}: IconButtonProps) {
  return (
    <Button
      {...rest}
      aria-label={label}
      className={cx(variant, className, active && "on") || undefined}
    >
      <Icon name={icon} className={iconClassName} />
      {children}
    </Button>
  );
}
