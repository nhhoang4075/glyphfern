import type { ReactNode } from "react";
import { Button } from "./button";
import { cx } from "./cx";

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: string;
  content: ReactNode;
  className?: string;
}

export interface SegmentedProps<T extends string | number> {
  options: readonly SegmentedOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  label?: string;
  container?: "div" | "fieldset";
  semantics?: "pressed" | "tab";
  className?: string;
  optionClassName?: string;
  activeClassName?: string;
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  container = "div",
  semantics = "pressed",
  className,
  optionClassName,
  activeClassName,
}: SegmentedProps<T>) {
  const items = options.map((option) => {
    const selected = option.value === value;
    return (
      <Button
        key={option.value}
        role={semantics === "tab" ? "tab" : undefined}
        className={cx(optionClassName, option.className, selected && activeClassName) || undefined}
        aria-label={option.label}
        aria-pressed={semantics === "pressed" ? selected : undefined}
        aria-selected={semantics === "tab" ? selected : undefined}
        onClick={() => onChange(option.value)}
      >
        {option.content}
      </Button>
    );
  });
  if (container === "fieldset") {
    return (
      <fieldset className={className} aria-label={label}>
        {items}
      </fieldset>
    );
  }
  return (
    <div
      className={className}
      role={semantics === "tab" ? "tablist" : undefined}
      aria-label={label}
    >
      {items}
    </div>
  );
}
