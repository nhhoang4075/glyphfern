import type { ComponentPropsWithoutRef } from "react";

export interface SectionProps extends ComponentPropsWithoutRef<"div"> {
  label?: string;
}

export function Section({ label, ...rest }: SectionProps) {
  return <div {...rest} aria-label={label} />;
}
