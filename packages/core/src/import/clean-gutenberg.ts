import type { TextBlock } from "./html-blocks";

const START_MARKER = /\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG/i;
const END_MARKER = /\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG/i;
const ROMAN_ONLY = /^[-–—\s]*[IVXLCDM]+[-–—\s]*[,.]?$/;
const MIN_CONTENTS_RUN = 3;

function findMarker(
  documents: readonly TextBlock[][],
  pattern: RegExp,
): { document: number; block: number } | undefined {
  for (const [document, blocks] of documents.entries()) {
    const block = blocks.findIndex((candidate) => pattern.test(candidate.text));
    if (block >= 0) {
      return { document, block };
    }
  }
  return undefined;
}

export function cutGutenbergBoilerplate(documents: readonly TextBlock[][]): TextBlock[][] {
  const start = findMarker(documents, START_MARKER);
  const end = findMarker(documents, END_MARKER);
  if (!start && !end) {
    return documents.map((blocks) => [...blocks]);
  }
  const result: TextBlock[][] = [];
  for (const [index, blocks] of documents.entries()) {
    if (start && index < start.document) {
      continue;
    }
    if (end && index > end.document) {
      continue;
    }
    const from = start && index === start.document ? start.block + 1 : 0;
    const to = end && index === end.document ? end.block : blocks.length;
    result.push(blocks.slice(from, Math.max(from, to)));
  }
  return result.filter((blocks) => blocks.length > 0);
}

export function dropContentsRuns(blocks: readonly TextBlock[]): TextBlock[] {
  const kept: TextBlock[] = [];
  let index = 0;
  while (index < blocks.length) {
    let end = index;
    while (end < blocks.length && ROMAN_ONLY.test(blocks[end]?.text ?? "")) {
      end += 1;
    }
    if (end - index >= MIN_CONTENTS_RUN) {
      index = end;
    } else {
      const block = blocks[index];
      if (block) {
        kept.push(block);
      }
      index += 1;
    }
  }
  return kept;
}
