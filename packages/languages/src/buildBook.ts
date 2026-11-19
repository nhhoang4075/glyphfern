import type { Book, Chapter, DictEntry, Lang, Morpheme, Sentence, Token } from "@glyphfern/core";

export interface RawSentence {
  text: string;
  vi: string;
}

export interface RawChapter {
  title: string;
  titleVi?: string;
  paragraphs: RawSentence[][];
}

export type RawDictTuple = readonly [string, string, string, string];

export interface BookSource {
  id: string;
  title: string;
  lang: Lang;
  chapters: readonly RawChapter[];
  notes: readonly (readonly string[])[];
}

const WORD_PATTERN = /^([^\p{L}]*)([\p{L}]+)([^\p{L}]*)$/u;
const LEMMA_PATTERN = /^([\p{L}]*)([^\p{L}]*)$/u;

function parseMorphemes(analysis: string): Morpheme[] {
  return analysis.split("+").map((part) => {
    const separator = part.indexOf("=");
    const form = separator === -1 ? part : part.slice(0, separator);
    const gloss = separator === -1 ? "" : part.slice(separator + 1);
    return { form, gloss: gloss.replaceAll("_", " ") };
  });
}

export function parseToken(raw: string): Token {
  const [surfaceField = "", lemmaField = "", groupField = "", analysisField = ""] = raw.split("|");
  const word = WORD_PATTERN.exec(surfaceField);
  const lemmaParts = LEMMA_PATTERN.exec(lemmaField);
  const surf = word ? (word[2] ?? "") : surfaceField;
  const lead = word ? (word[1] ?? "") : "";
  const wordTrail = word ? (word[3] ?? "") : "";
  const lemmaCore = lemmaParts?.[1] ?? "";
  const lemmaTrail = lemmaParts?.[2] ?? "";
  const morphemes = analysisField ? parseMorphemes(analysisField) : [];

  return {
    lead,
    surf,
    trail: wordTrail + lemmaTrail,
    lemma: lemmaCore || surf.toLowerCase(),
    ...(groupField ? { group: groupField } : {}),
    ...(morphemes.length > 0 ? { morphemes } : {}),
  };
}

export function parseTokens(text: string): Token[] {
  return text
    .split(" ")
    .filter((raw) => raw.length > 0)
    .map(parseToken);
}

export function buildBook(source: BookSource): Book {
  let nextId = 0;
  let bodyIndex = 0;

  const chapters: Chapter[] = source.chapters.map((chapter, chapterIndex) => {
    const title: Sentence = {
      id: nextId++,
      chapter: chapterIndex,
      kind: "title",
      tokens: parseTokens(chapter.title),
      ...(chapter.titleVi !== undefined ? { vi: chapter.titleVi } : {}),
    };

    const paragraphs: Sentence[][] = chapter.paragraphs.map((paragraph) =>
      paragraph.map((raw): Sentence => {
        const notes = source.notes[bodyIndex];
        if (notes === undefined) {
          throw new Error(`Missing notes for body sentence ${bodyIndex} in book ${source.id}`);
        }
        const sentence: Sentence = {
          id: nextId++,
          chapter: chapterIndex,
          kind: "body",
          tokens: parseTokens(raw.text),
          vi: raw.vi,
          notes: [...notes],
        };
        bodyIndex++;
        return sentence;
      }),
    );

    return { title, paragraphs };
  });

  if (source.notes.length !== bodyIndex) {
    throw new Error(
      `Notes count ${source.notes.length} does not match body sentence count ${bodyIndex} in book ${source.id}`,
    );
  }

  return { id: source.id, title: source.title, lang: source.lang, chapters };
}

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
