import type { GrammarRequest } from "./grammar-client";

export const MAX_NOTES = 4;
export const MIN_NOTES = 2;
export const MAX_NOTE_CHARS = 160;

export const GRAMMAR_SYSTEM_PROMPT = [
  "You are a Spanish grammar tutor for a Vietnamese learner.",
  "You receive ONE Spanish sentence, the tapped surface form of a word in it, and that word's lemma.",
  `Return a JSON array of ${MIN_NOTES} to ${MAX_NOTES} short notes written IN VIETNAMESE, each at most ${MAX_NOTE_CHARS} characters.`,
  "The notes explain the grammar of that word in this sentence: tense, mood and person, agreement, its role in the clause, and any idiom it belongs to.",
  'No markdown, no preamble, no explanation outside the array. Output JSON only, for example ["note one", "note two"].',
].join(" ");

export function grammarUserPrompt(request: GrammarRequest): string {
  return JSON.stringify({
    lang: request.lang,
    sentence: request.sentence,
    word: request.word,
    lemma: request.lemma,
  });
}
