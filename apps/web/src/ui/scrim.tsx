import { Button } from "./button";
import { cx } from "./cx";

export interface ScrimProps {
  open: boolean;
  label: string;
  onClose: () => void;
  className?: string;
}

export function Scrim({ open, label, onClose, className }: ScrimProps) {
  return (
    <Button
      className={cx("scrim", className, open && "on")}
      aria-label={label}
      tabIndex={-1}
      onClick={onClose}
    />
  );
}
