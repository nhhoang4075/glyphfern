import type { Morpheme, Token } from "./types";

const TOKEN_SEPARATOR = " ";
const FIELD_SEPARATOR = "|";
const MORPHEME_SEPARATOR = "+";
const FORM_GLOSS_SEPARATOR = "=";
const GLOSS_UNDERSCORE = "_";
const GLOSS_SPACE = " ";

const SURFACE_PATTERN = /^(\P{L}*)(.*?)(\P{L}*)$/u;

export function parseTokens(text: string): Token[] {
  return text
    .split(TOKEN_SEPARATOR)
    .filter((entry) => entry.length > 0)
    .map(parseToken);
}

function parseToken(entry: string): Token {
  const [surfaceField = "", lemmaField = "", groupField = "", analysisField = ""] =
    entry.split(FIELD_SEPARATOR);
  const { lead, surf, trail } = splitSurface(surfaceField);
  const token: Token = {
    lead,
    surf,
    trail,
    lemma: lemmaField.length > 0 ? lemmaField : surf.toLowerCase(),
  };
  if (groupField.length > 0) {
    token.group = groupField;
  }
  if (analysisField.length > 0) {
    token.morphemes = parseMorphemes(analysisField);
  }
  return token;
}

function splitSurface(surfaceField: string): { lead: string; surf: string; trail: string } {
  const match = SURFACE_PATTERN.exec(surfaceField);
  return {
    lead: match?.[1] ?? "",
    surf: match?.[2] ?? "",
    trail: match?.[3] ?? "",
  };
}

function parseMorphemes(analysisField: string): Morpheme[] {
  return analysisField.split(MORPHEME_SEPARATOR).map(parseMorpheme);
}

function parseMorpheme(part: string): Morpheme {
  const separatorIndex = part.indexOf(FORM_GLOSS_SEPARATOR);
  if (separatorIndex === -1) {
    return { form: part, gloss: "" };
  }
  const form = part.slice(0, separatorIndex);
  const rawGloss = part.slice(separatorIndex + FORM_GLOSS_SEPARATOR.length);
  return { form, gloss: rawGloss.split(GLOSS_UNDERSCORE).join(GLOSS_SPACE) };
}
