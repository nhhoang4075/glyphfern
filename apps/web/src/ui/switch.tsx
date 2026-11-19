import { Button, type ButtonProps } from "./button";
import { cx } from "./cx";

export interface SwitchProps extends Omit<ButtonProps, "onChange" | "role"> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

export function Switch({ checked, onChange, label, className, ...rest }: SwitchProps) {
  return (
    <Button
      {...rest}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={cx("switch", className, checked && "on")}
      onClick={() => onChange(!checked)}
    />
  );
}
