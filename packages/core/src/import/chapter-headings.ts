import type { TextBlock } from "./html-blocks";

export interface HeadingChapter {
  titleText: string | undefined;
  body: TextBlock[];
}

const BARE_NUMERAL = /^[-–—\s]*([IVXLCDM]+)[-–—\s]*[,.]?$/;
const HEADING_NUMERAL = /^[-–—\s]*([IVXLCDM]+)(?![\p{L}\d])[-–—.,:\s]*(.*)$/u;
const MIN_HEADINGS = 2;
const MIN_PREFACE_CHARACTERS = 300;
const TITLE_SEPARATOR = " · ";

function headingTitle(block: TextBlock): string | undefined {
  if (block.kind === "paragraph") {
    return BARE_NUMERAL.exec(block.text)?.[1];
  }
  const match = HEADING_NUMERAL.exec(block.text);
  if (!match) {
    return undefined;
  }
  const subtitle = (match[2] ?? "").trim();
  return subtitle ? `${match[1]}${TITLE_SEPARATOR}${subtitle}` : match[1];
}

export function splitByNumeralHeadings(blocks: readonly TextBlock[]): HeadingChapter[] | undefined {
  const titles = blocks.map(headingTitle);
  if (titles.filter((title) => title !== undefined).length < MIN_HEADINGS) {
    return undefined;
  }
  const chapters: HeadingChapter[] = [];
  const preface: TextBlock[] = [];
  blocks.forEach((block, index) => {
    const title = titles[index];
    if (title !== undefined) {
      chapters.push({ titleText: title, body: [] });
      return;
    }
    const current = chapters[chapters.length - 1];
    if (current) {
      current.body.push(block);
    } else {
      preface.push(block);
    }
  });
  const prefaceLength = preface.reduce((sum, block) => sum + block.text.length, 0);
  return prefaceLength >= MIN_PREFACE_CHARACTERS
    ? [{ titleText: undefined, body: preface }, ...chapters]
    : chapters;
}
