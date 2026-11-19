import type { Lang } from "../types";
import { type HeadingChapter, splitByNumeralHeadings } from "./chapter-headings";
import { cutGutenbergBoilerplate, dropContentsRuns } from "./clean-gutenberg";
import { dropEnglishBlocks } from "./drop-english-blocks";
import { type NavigationEntry, parseNavDocument, parseNcx } from "./epub-navigation";
import {
  type OpfPackage,
  findRootfilePath,
  parseOpf,
  resolveHref,
  splitHref,
} from "./epub-package";
import { type TextBlock, countWords, extractAnchoredBlocks } from "./html-blocks";
import { EpubImportError } from "./import-error";
import {
  type EntryTarget,
  MIN_DOCUMENT_TOKENS,
  type ResolvedEntry,
  type SourceDocument,
  resolveEntries,
  segmentOwners,
  sortByPosition,
} from "./navigation-chapters";
import { splitByChapterHeadings } from "./paragraph-chapters";

export interface ChapterCandidate {
  id: string;
  title: string;
  wordCount: number;
  frontBackMatter: boolean;
  blocks: readonly TextBlock[];
}

export interface EpubPreview {
  title: string;
  lang: Lang;
  source: "navigation" | "headings";
  chapters: readonly ChapterCandidate[];
}

export interface ParseOptions {
  lang: Lang;
  fallbackTitle: (chapterNumber: number) => string;
}

const CONTENT_TYPES = new Set(["application/xhtml+xml", "text/html"]);
const NCX_TYPE = "application/x-dtbncx+xml";
const MIN_CHAPTER_CHARACTERS = 300;
const MIN_NAVIGATION_ENTRIES = 2;
const CONTAINER_PATH = "META-INF/container.xml";

interface Package {
  opf: OpfPackage;
  opfPath: string;
  documents: SourceDocument[];
  entries: EntryTarget[];
}

function foldTitle(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

function loadPackage(files: Readonly<Record<string, string>>): Package {
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
  const documents: SourceDocument[] = [];
  for (const { idref, linear } of opf.documents) {
    const item = opf.items.get(idref);
    if (!item || !CONTENT_TYPES.has(item.mediaType) || item.properties.includes("nav")) {
      continue;
    }
    const path = resolveHref(opfPath, item.href);
    const html = files[path] ?? "";
    documents.push({ path, linear, html, ...extractAnchoredBlocks(html) });
  }
  return { opf, opfPath, documents, entries: navigationTargets(files, opf, opfPath) };
}

function navigationTargets(
  files: Readonly<Record<string, string>>,
  opf: OpfPackage,
  opfPath: string,
): EntryTarget[] {
  const items = [...opf.items.values()];
  const navItem = items.find((item) => item.properties.includes("nav"));
  const ncxItem = items.find((item) => item.mediaType === NCX_TYPE);
  const navPath = navItem ? resolveHref(opfPath, navItem.href) : undefined;
  const navEntries = navPath ? parseNavDocument(files[navPath] ?? "") : [];
  const ncxPath = ncxItem ? resolveHref(opfPath, ncxItem.href) : undefined;
  const source: { path: string; entries: NavigationEntry[] } | undefined =
    navPath && navEntries.length > 0
      ? { path: navPath, entries: navEntries }
      : ncxPath
        ? { path: ncxPath, entries: parseNcx(files[ncxPath] ?? "") }
        : undefined;
  return (source?.entries ?? []).map((entry) => ({
    entry,
    path: resolveHref(source?.path ?? "", entry.href),
    fragment: splitHref(entry.href).fragment,
  }));
}

function candidate(
  id: string,
  title: string,
  blocks: readonly TextBlock[],
  frontBackMatter: boolean,
): ChapterCandidate {
  return { id, title, wordCount: countWords(blocks), frontBackMatter, blocks };
}

function dropRepeatedTitle(blocks: readonly TextBlock[], label: string): TextBlock[] {
  const first = blocks[0];
  return first?.kind === "heading" && foldTitle(first.text) === foldTitle(label)
    ? blocks.slice(1)
    : [...blocks];
}

function navigationChapters(
  pack: Package,
  options: ParseOptions,
  entries: readonly ResolvedEntry[],
): ChapterCandidate[] {
  const targeted = new Set(entries.map((entry) => entry.documentIndex));
  const active = pack.documents.map((document, index) =>
    document.linear || targeted.has(index) ? document : { ...document, blocks: [] },
  );
  const ordered = sortByPosition(entries);
  const owners = segmentOwners(active, ordered);
  const cut = cutGutenbergBoilerplate(active.map((document) => document.blocks));
  const cleaned = options.lang === "es" ? dropEnglishBlocks(cut) : cut;
  const survivors = new Set(cleaned.flat());
  const documentWords = active.map((document) =>
    countWords(document.blocks.filter((block) => survivors.has(block))),
  );
  const groups: TextBlock[][] = ordered.map(() => []);
  for (const block of cleaned.flat()) {
    const owner = owners.get(block);
    if (owner !== undefined) {
      groups[owner]?.push(block);
    }
  }
  const chapters: ChapterCandidate[] = [];
  ordered.forEach((entry, index) => {
    const blocks = dropRepeatedTitle(groups[index] ?? [], entry.label);
    if (countWords(blocks) === 0) {
      return;
    }
    const number = chapters.length + 1;
    const title = entry.label || options.fallbackTitle(number);
    const short = (documentWords[entry.documentIndex] ?? 0) < MIN_DOCUMENT_TOKENS;
    chapters.push(candidate(`chapter-${number}`, title, blocks, entry.marked || short));
  });
  return chapters;
}

function documentChapters(parsed: readonly TextBlock[][]): HeadingChapter[] {
  const substantial = parsed.filter(
    (blocks) => blocks.reduce((sum, block) => sum + block.text.length, 0) >= MIN_CHAPTER_CHARACTERS,
  );
  const documents = substantial.length > 0 ? substantial : parsed.filter((blocks) => blocks.length);
  return documents.map((blocks) => {
    const first = blocks[0];
    return first?.kind === "heading"
      ? { titleText: first.text, body: blocks.slice(1) }
      : { titleText: undefined, body: blocks };
  });
}

function headingChapters(pack: Package, options: ParseOptions): ChapterCandidate[] {
  const linear = pack.documents.filter((document) => document.linear);
  const cleaned = cutGutenbergBoilerplate(linear.map((document) => document.blocks)).map(
    dropContentsRuns,
  );
  const parsed = options.lang === "es" ? dropEnglishBlocks(cleaned) : cleaned;
  const groups =
    splitByChapterHeadings(parsed.flat()) ??
    splitByNumeralHeadings(parsed.flat()) ??
    documentChapters(parsed);
  const chapters: ChapterCandidate[] = [];
  for (const group of groups) {
    if (countWords(group.body) === 0) {
      continue;
    }
    const number = chapters.length + 1;
    const title = group.titleText ?? options.fallbackTitle(number);
    chapters.push(candidate(`chapter-${number}`, title, group.body, false));
  }
  return chapters;
}

export function parseEpubChapters(
  files: Readonly<Record<string, string>>,
  options: ParseOptions,
): EpubPreview {
  const pack = loadPackage(files);
  const entries = resolveEntries(pack.entries, pack.documents);
  const usesNavigation = entries.length >= MIN_NAVIGATION_ENTRIES;
  const chapters = usesNavigation
    ? navigationChapters(pack, options, entries)
    : headingChapters(pack, options);
  if (chapters.length === 0) {
    throw new EpubImportError("empty", "EPUB has no readable text");
  }
  return {
    title: pack.opf.title || "",
    lang: options.lang,
    source: usesNavigation ? "navigation" : "headings",
    chapters,
  };
}
