import type { DictEntry } from "@glyphfern/core";

export const MEANING_UNAVAILABLE = "Chưa tra được nghĩa";

export interface CardBack {
  lemma: string;
  pronunciation: string;
  meaning: string;
  note: string | undefined;
  meaningFound: boolean;
}

function fromEntry(lemma: string, entry: DictEntry): CardBack {
  const meaningFound = entry.meaning.length > 0;
  return {
    lemma,
    pronunciation: entry.pronunciation,
    meaning: meaningFound ? entry.meaning : MEANING_UNAVAILABLE,
    note: entry.note,
    meaningFound,
  };
}

export function cardBack(
  lemma: string,
  staticEntry: DictEntry | undefined,
  lookedUpEntry: DictEntry | undefined,
): CardBack {
  const entry = staticEntry ?? lookedUpEntry;
  if (entry === undefined) {
    return {
      lemma,
      pronunciation: "",
      meaning: MEANING_UNAVAILABLE,
      note: undefined,
      meaningFound: false,
    };
  }
  return fromEntry(lemma, entry);
}
