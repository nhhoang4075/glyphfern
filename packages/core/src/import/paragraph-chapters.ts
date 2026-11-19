import type { HeadingChapter } from "./chapter-headings";
import type { TextBlock } from "./html-blocks";

const CHAPTER_HEADING = /^cap[ií]tulo\s+(\d{1,3})(?![\p{L}\d])\s*(?:[–—:.-]+\s*(.*))?$/iu;
const STORY_HEADING = /^(\d{1,2})\s*[.)]\s*(.*)$/u;
const MIN_CHAPTER_HEADINGS = 2;
const MAX_HEADING_CHARACTERS = 80;
const MAX_STORY_TITLE_CHARACTERS = 60;
const END_MARKER = /^fin$/i;
const TITLE_SEPARATOR = " · ";

interface ChapterHeading {
  number: string;
  title: string;
}

function chapterHeading(block: TextBlock | undefined): ChapterHeading | undefined {
  if (!block || block.kind !== "paragraph" || block.text.length > MAX_HEADING_CHARACTERS) {
    return undefined;
  }
  const match = CHAPTER_HEADING.exec(block.text);
  return match ? { number: match[1] ?? "", title: (match[2] ?? "").trim() } : undefined;
}

function shortParagraph(block: TextBlock | undefined): string | undefined {
  return block && block.kind === "paragraph" && block.text.length <= MAX_STORY_TITLE_CHARACTERS
    ? block.text
    : undefined;
}

function storyTitleAt(blocks: readonly TextBlock[], index: number): string | undefined {
  const text = shortParagraph(blocks[index]);
  const match = text ? STORY_HEADING.exec(text) : undefined;
  if (!match) {
    return undefined;
  }
  const inline = (match[2] ?? "").trim();
  if (inline) {
    return chapterHeading(blocks[index + 1]) ? inline : undefined;
  }
  const following = shortParagraph(blocks[index + 1]);
  return following && chapterHeading(blocks[index + 2]) ? following : undefined;
}

function joinTitle(parts: readonly string[]): string {
  return parts.filter((part) => part.length > 0).join(TITLE_SEPARATOR);
}

export function countChapterHeadings(blocks: readonly TextBlock[]): number {
  return blocks.filter((block) => chapterHeading(block) !== undefined).length;
}

export function hasChapterHeadings(blocks: readonly TextBlock[]): boolean {
  return countChapterHeadings(blocks) >= MIN_CHAPTER_HEADINGS;
}

export function splitByChapterHeadings(blocks: readonly TextBlock[]): HeadingChapter[] | undefined {
  if (!hasChapterHeadings(blocks)) {
    return undefined;
  }
  const chapters: HeadingChapter[] = [];
  let story = "";
  let index = 0;
  while (index < blocks.length) {
    const block = blocks[index];
    if (!block) {
      break;
    }
    const storyTitle = storyTitleAt(blocks, index);
    if (storyTitle !== undefined) {
      story = storyTitle;
      const inline = STORY_HEADING.exec(block.text)?.[2]?.trim();
      index += inline ? 1 : 2;
      continue;
    }
    const heading = chapterHeading(block);
    if (heading) {
      chapters.push({
        titleText: joinTitle([story, joinTitle([heading.number, heading.title])]),
        body: [],
      });
    } else {
      chapters[chapters.length - 1]?.body.push(block);
    }
    index += 1;
  }
  const last = chapters[chapters.length - 1];
  const endIndex = last ? last.body.findIndex((block) => END_MARKER.test(block.text)) : -1;
  if (last && endIndex >= 0) {
    last.body = last.body.slice(0, endIndex);
  }
  return chapters;
}
