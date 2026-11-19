export type ClassPart = string | false | null | undefined;

export function cx(...parts: ClassPart[]): string {
  return parts.filter((part): part is string => Boolean(part)).join(" ");
}
