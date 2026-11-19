import { cx } from "./cx";

export interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  label: string;
  onChange: (value: number) => void;
  className?: string;
}

export function Slider({ value, min, max, step = 1, label, onChange, className }: SliderProps) {
  return (
    <input
      type="range"
      className={cx("slider", className) || undefined}
      min={min}
      max={max}
      step={step}
      value={value}
      aria-label={label}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  );
}
