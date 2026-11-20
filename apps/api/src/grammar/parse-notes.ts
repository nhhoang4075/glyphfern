import { MAX_NOTES } from "./grammar-prompt";

const FENCE = /^```[a-zA-Z]*\s*([\s\S]*?)\s*```$/;

export function parseNotes(raw: string): string[] | undefined {
  const trimmed = raw.trim();
  const unfenced = FENCE.exec(trimmed)?.[1] ?? trimmed;
  let parsed: unknown;
  try {
    parsed = JSON.parse(unfenced);
  } catch {
    return undefined;
  }
  if (!Array.isArray(parsed)) {
    return undefined;
  }
  const notes: string[] = [];
  for (const item of parsed) {
    if (typeof item !== "string" || item.trim().length === 0) {
      return undefined;
    }
    notes.push(item.trim());
  }
  return notes.length === 0 ? undefined : notes.slice(0, MAX_NOTES);
}
