import type { Token } from "../types";

const SURFACE_PATTERN = /^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/u;
const LETTER_PATTERN = /[\p{L}\p{N}]/u;

export function splitSentences(text: string, locale: string): string[] {
  const segmenter = new Intl.Segmenter(locale, { granularity: "sentence" });
  return [...segmenter.segment(text)].map((part) => part.segment.trim()).filter(Boolean);
}

export function tokenizeSentence(sentence: string): Token[] {
  const tokens: Token[] = [];
  let pendingLead = "";
  for (const chunk of sentence.split(/\s+/).filter(Boolean)) {
    if (!LETTER_PATTERN.test(chunk)) {
      const last = tokens[tokens.length - 1];
      if (last) {
        last.trail += chunk;
      } else {
        pendingLead += chunk;
      }
      continue;
    }
    const match = SURFACE_PATTERN.exec(chunk);
    const lead = pendingLead + (match?.[1] ?? "");
    const surf = match?.[2] ?? chunk;
    const trail = match?.[3] ?? "";
    pendingLead = "";
    tokens.push({ lead, surf, trail, lemma: surf.toLowerCase() });
  }
  return tokens;
}
