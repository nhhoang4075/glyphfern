import type { Book, Chapter, Lang, Sentence } from "../types";
import { type HeadingChapter, splitByNumeralHeadings } from "./chapter-headings";
import { cutGutenbergBoilerplate, dropContentsRuns } from "./clean-gutenberg";
import { dropEnglishBlocks } from "./drop-english-blocks";
import { findRootfilePath, parseOpf, resolveHref } from "./epub-package";
import { type TextBlock, extractBlocks } from "./html-blocks";
import { splitSentences, tokenizeSentence } from "./split-text";

export class EpubImportError extends Error {
  constructor(
    readonly reason: "container" | "package" | "empty",
    message: string,
  ) {
    super(message);
  }
}

export interface EpubImportOptions {
  id: string;
  lang: Lang;
  locale: string;
  firstSentenceId: number;
  fallbackTitle: (chapterNumber: number) => string;
}

export interface EpubImportResult {
  book: Book;
  sentenceCount: number;
}

const CONTENT_TYPES = new Set(["application/xhtml+xml", "text/html"]);
const MIN_CHAPTER_CHARACTERS = 300;
const CONTAINER_PATH = "META-INF/container.xml";

function chapterBlocks(files: Readonly<Record<string, string>>, paths: readonly string[]) {
  return paths.map((path) => extractBlocks(files[path] ?? ""));
}

function characterCount(blocks: readonly TextBlock[]): number {
  return blocks.reduce((sum, block) => sum + block.text.length, 0);
}

function documentChapters(parsed: readonly TextBlock[][]): HeadingChapter[] {
  const substantial = parsed.filter((blocks) => characterCount(blocks) >= MIN_CHAPTER_CHARACTERS);
  const documents = substantial.length > 0 ? substantial : parsed.filter((blocks) => blocks.length);
  return documents.map((blocks) => {
    const first = blocks[0];
    return first?.kind === "heading"
      ? { titleText: first.text, body: blocks.slice(1) }
      : { titleText: undefined, body: blocks };
  });
}

export function buildEpubBook(
  files: Readonly<Record<string, string>>,
  options: EpubImportOptions,
): EpubImportResult {
  const containerXml = files[CONTAINER_PATH];
  const opfPath = containerXml ? findRootfilePath(containerXml) : undefined;
  if (!opfPath) {
    throw new EpubImportError("container", "EPUB container has no root file");
  }
  const opfXml = files[opfPath];
  if (!opfXml) {
    throw new EpubImportError("package", "EPUB package file is missing");
  }
  const opf = parseOpf(opfXml);
  const paths = opf.spine.flatMap((idref) => {
    const item = opf.items.get(idref);
    return item && CONTENT_TYPES.has(item.mediaType) ? [resolveHref(opfPath, item.href)] : [];
  });
  const cleaned = cutGutenbergBoilerplate(chapterBlocks(files, paths)).map(dropContentsRuns);
  const parsed = options.lang === "es" ? dropEnglishBlocks(cleaned) : cleaned;
  const groups = splitByNumeralHeadings(parsed.flat()) ?? documentChapters(parsed);

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
  for (const group of groups) {
    const chapterIndex = chapters.length;
    const titleText = group.titleText ?? options.fallbackTitle(chapterIndex + 1);
    const paragraphTexts = group.body
      .map((block) => splitSentences(block.text, options.locale))
      .filter((texts) => texts.length > 0);
    if (paragraphTexts.length === 0) {
      continue;
    }
    const title = makeSentence(titleText, chapterIndex, "title");
    const paragraphs = paragraphTexts.map((texts) =>
      texts.map((text) => makeSentence(text, chapterIndex, "body")),
    );
    chapters.push({ title, paragraphs });
  }
  if (chapters.length === 0) {
    throw new EpubImportError("empty", "EPUB has no readable text");
  }
  const book: Book = {
    id: options.id,
    title: opf.title || options.id,
    lang: options.lang,
    chapters,
  };
  return { book, sentenceCount: nextId - options.firstSentenceId };
}
