import type { DictEntry } from "@glyphfern/core";

export type RawDictTuple = readonly [string, string, string, string];

export function buildDictionary(
  raw: Record<string, RawDictTuple>,
  normalizePos: (pos: string) => string = (pos) => pos,
): Record<string, DictEntry> {
  return Object.fromEntries(
    Object.entries(raw).map(([lemma, [pos, pronunciation, meaning, note]]): [string, DictEntry] => [
      lemma,
      {
        pos: normalizePos(pos),
        pronunciation,
        meaning,
        ...(note ? { note } : {}),
      },
    ]),
  );
}
