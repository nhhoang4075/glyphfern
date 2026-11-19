import type { Book, Chapter, Lang, Sentence } from "../types";
import { EpubImportError } from "./import-error";
import { type EpubPreview, type ParseOptions, parseEpubChapters } from "./parse-epub-chapters";
import { splitSentences, tokenizeSentence } from "./split-text";

export interface BuildOptions {
  id: string;
  lang: Lang;
  locale: string;
  firstSentenceId: number;
}

export interface EpubImportOptions extends BuildOptions {
  fallbackTitle: ParseOptions["fallbackTitle"];
}

export interface EpubImportResult {
  book: Book;
  sentenceCount: number;
}

export function defaultSelectedIds(preview: EpubPreview): string[] {
  return preview.chapters
    .filter((chapter) => !chapter.frontBackMatter)
    .map((chapter) => chapter.id);
}

export function buildBookFromChapters(
  preview: EpubPreview,
  selectedIds: readonly string[],
  options: BuildOptions,
): EpubImportResult {
  const selected = new Set(selectedIds);
  const picked = preview.chapters.filter((chapter) => selected.has(chapter.id));
  let nextId = options.firstSentenceId;
  const makeSentence = (text: string, chapter: number, kind: Sentence["kind"]): Sentence => {
    const sentence: Sentence = {
      id: nextId,
      chapter,
      kind,
      tokens: tokenizeSentence(text),
    };
    nextId += 1;
    return sentence;
  };

  const chapters: Chapter[] = [];
  for (const candidate of picked) {
    const chapterIndex = chapters.length;
    const paragraphTexts = candidate.blocks
      .map((block) => splitSentences(block.text, options.locale))
      .filter((texts) => texts.length > 0);
    if (paragraphTexts.length === 0) {
      continue;
    }
    const title = makeSentence(candidate.title, chapterIndex, "title");
    const paragraphs = paragraphTexts.map((texts) =>
      texts.map((text) => makeSentence(text, chapterIndex, "body")),
    );
    chapters.push({ title, paragraphs });
  }
  if (chapters.length === 0) {
    throw new EpubImportError("empty", "No chapter with readable text is selected");
  }
  const book: Book = {
    id: options.id,
    title: preview.title || options.id,
    lang: options.lang,
    chapters,
  };
  return { book, sentenceCount: nextId - options.firstSentenceId };
}

export function buildEpubBook(
  files: Readonly<Record<string, string>>,
  options: EpubImportOptions,
): EpubImportResult {
  const preview = parseEpubChapters(files, options);
  const defaults = defaultSelectedIds(preview);
  const ids = defaults.length > 0 ? defaults : preview.chapters.map((chapter) => chapter.id);
  return buildBookFromChapters(preview, ids, options);
}
