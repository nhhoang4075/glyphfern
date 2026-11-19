import type { HeadingChapter } from "./chapter-headings";
import type { TextBlock } from "./html-blocks";

const CHAPTER_HEADING = /^cap[ií]tulo\s+(\d{1,3})(?![\p{L}\d])\s*(?:[–—:.-]+\s*(.*))?$/iu;
const MIN_CHAPTER_HEADINGS = 2;
const MAX_HEADING_CHARACTERS = 80;
const TITLE_SEPARATOR = " · ";

function chapterTitle(block: TextBlock): string | undefined {
  if (block.kind !== "paragraph" || block.text.length > MAX_HEADING_CHARACTERS) {
    return undefined;
  }
  const match = CHAPTER_HEADING.exec(block.text);
  if (!match) {
    return undefined;
  }
  const parts = [match[1] ?? "", (match[2] ?? "").trim()];
  return parts.filter((part) => part.length > 0).join(TITLE_SEPARATOR);
}

export function splitByChapterHeadings(blocks: readonly TextBlock[]): HeadingChapter[] | undefined {
  const titles = blocks.map(chapterTitle);
  if (titles.filter((title) => title !== undefined).length < MIN_CHAPTER_HEADINGS) {
    return undefined;
  }
  const chapters: HeadingChapter[] = [];
  blocks.forEach((block, index) => {
    const title = titles[index];
    if (title !== undefined) {
      chapters.push({ titleText: title, body: [] });
    } else {
      chapters[chapters.length - 1]?.body.push(block);
    }
  });
  return chapters;
}
