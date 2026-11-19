export interface LexiconRow {
  word: string;
  pos: string;
  ipa: string | null;
  glosses: string[];
  lemma: string | null;
}

interface KaikkiSense {
  glosses?: string[];
  form_of?: { word?: string }[];
  alt_of?: { word?: string }[];
  tags?: string[];
}

interface KaikkiEntry {
  word?: string;
  pos?: string;
  lang_code?: string;
  senses?: KaikkiSense[];
  sounds?: { ipa?: string }[];
}

const MAX_GLOSSES = 6;
const MAX_GLOSS_LENGTH = 160;
const DEPRIORITIZED_TAGS = new Set(["obsolete", "archaic", "rare", "dated", "historical"]);

function formOf(sense: KaikkiSense): string | undefined {
  return sense.form_of?.[0]?.word ?? sense.alt_of?.[0]?.word;
}

function isPreferred(sense: KaikkiSense): boolean {
  return !(sense.tags ?? []).some((tag) => DEPRIORITIZED_TAGS.has(tag));
}

function glossOf(sense: KaikkiSense): string | undefined {
  const gloss = sense.glosses?.[sense.glosses.length - 1]?.trim();
  return gloss ? gloss.slice(0, MAX_GLOSS_LENGTH) : undefined;
}

export function parseKaikkiLine(line: string, lang: string): LexiconRow | undefined {
  let entry: KaikkiEntry;
  try {
    entry = JSON.parse(line) as KaikkiEntry;
  } catch {
    return undefined;
  }
  if (entry.lang_code !== lang || !entry.word || !entry.pos) {
    return undefined;
  }
  const senses = entry.senses ?? [];
  const ipa = entry.sounds?.find((sound) => sound.ipa)?.ipa ?? null;
  const lemma =
    senses.length > 0 && senses.every((sense) => formOf(sense))
      ? formOf(senses[0] as KaikkiSense)
      : undefined;
  if (lemma) {
    return { word: entry.word, pos: entry.pos, ipa, glosses: [], lemma: lemma.toLowerCase() };
  }
  const usable = senses.filter((sense) => !formOf(sense));
  const preferred = usable.filter(isPreferred);
  const chosen = preferred.length > 0 ? preferred : usable;
  const glosses = chosen
    .map(glossOf)
    .filter((gloss): gloss is string => gloss !== undefined)
    .slice(0, MAX_GLOSSES);
  if (glosses.length === 0) {
    return undefined;
  }
  return { word: entry.word, pos: entry.pos, ipa, glosses, lemma: null };
}
