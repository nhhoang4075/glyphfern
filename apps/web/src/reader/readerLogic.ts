import {
  type Sentence,
  type WordState,
  chapterProgress,
  nextChapterStartPage,
  search,
} from "@glyphfern/core";

export interface RevealState {
  translation: boolean;
  grammar: boolean;
}

export const CLOSED_REVEAL: RevealState = { translation: false, grammar: false };

export function toggleReveal(state: RevealState, which: keyof RevealState): RevealState {
  return { ...state, [which]: !state[which] };
}

export function isRevealOpen(state: RevealState): boolean {
  return state.translation || state.grammar;
}

export type EscapeAction = "closeLayers" | "exitFullscreen" | "none";

export function escapeAction(open: {
  popover: boolean;
  drawer: boolean;
  panel: boolean;
  fullscreen: boolean;
}): EscapeAction {
  if (open.popover || open.drawer || open.panel) return "closeLayers";
  if (open.fullscreen) return "exitFullscreen";
  return "none";
}

export const POPOVER_GAP = 4;
export const POPOVER_MIN_EDGE = 8;

export function popoverPlacement(
  button: { right: number; bottom: number },
  parent: { right: number; top: number },
): { right: number; top: number } {
  return {
    right: Math.max(POPOVER_MIN_EDGE, parent.right - button.right),
    top: button.bottom - parent.top + POPOVER_GAP,
  };
}

export interface ChapterRow {
  index: number;
  startPage: number;
  fraction: number;
  current: boolean;
}

export function chapterRows(
  startPages: readonly number[],
  page: number,
  totalPages: number,
  currentChapter: number,
): ChapterRow[] {
  return startPages.map((startPage, index) => ({
    index,
    startPage,
    fraction: chapterProgress(page, startPage, nextChapterStartPage(startPages, index, totalPages)),
    current: index === currentChapter,
  }));
}

export interface SentenceSpan {
  id: number;
  startPage: number;
  endPage: number;
}

export function bookmarksOnPage(
  spans: readonly SentenceSpan[],
  bookmarks: readonly number[],
  page: number,
): number[] {
  const marked = new Set(bookmarks);
  return spans
    .filter((span) => marked.has(span.id) && span.startPage <= page && page <= span.endPage)
    .map((span) => span.id);
}

export interface SearchPart {
  text: string;
  marked: boolean;
}

export interface SearchHit {
  sentenceId: number;
  parts: SearchPart[];
}

export function searchHits(sentences: readonly Sentence[], query: string): SearchHit[] {
  const byId = new Map(sentences.map((sentence) => [sentence.id, sentence]));
  const hits: SearchHit[] = [];
  for (const result of search(sentences, query)) {
    const sentence = byId.get(result.sentenceId);
    if (!sentence) continue;
    const marked = new Set(result.tokenIndexes);
    hits.push({
      sentenceId: sentence.id,
      parts: sentence.tokens.map((token, index) => ({
        text: token.lead + token.surf + token.trail,
        marked: marked.has(index),
      })),
    });
  }
  return hits;
}

export function groupMembers(sentence: Sentence, tokenIndex: number): number[] {
  const token = sentence.tokens[tokenIndex];
  if (!token) return [];
  if (token.group === undefined) return [tokenIndex];
  const members: number[] = [];
  sentence.tokens.forEach((candidate, index) => {
    if (candidate.group === token.group) members.push(index);
  });
  return members;
}

export function groupSurface(sentence: Sentence, tokenIndex: number): string {
  return groupMembers(sentence, tokenIndex)
    .map((index) => sentence.tokens[index]?.surf ?? "")
    .join(" ");
}

export function showsLemmaChip(lemma: string, surface: string): boolean {
  return lemma !== surface.toLowerCase();
}

export function sentenceText(sentence: Sentence): string {
  return sentence.tokens.map((token) => token.lead + token.surf + token.trail).join(" ");
}

const ROMAN_NUMERAL = /^[IVXLCDM]+$/;

export function isRomanNumeral(surface: string): boolean {
  return ROMAN_NUMERAL.test(surface);
}

export function highlightClass(state: WordState): "l1" | "l2" | "l3" | "" {
  return state.kind === "learning" ? (`l${state.level}` as "l1" | "l2" | "l3") : "";
}

export interface NoteSegment {
  text: string;
  bold: boolean;
  italic: boolean;
}

const NOTE_TAG = /(<\/?[bi]>)/;

export function noteSegments(markup: string): NoteSegment[] {
  const segments: NoteSegment[] = [];
  let bold = false;
  let italic = false;
  for (const piece of markup.split(NOTE_TAG)) {
    if (piece === "<b>") bold = true;
    else if (piece === "</b>") bold = false;
    else if (piece === "<i>") italic = true;
    else if (piece === "</i>") italic = false;
    else if (piece.length > 0) segments.push({ text: piece, bold, italic });
  }
  return segments;
}

export function hasLearningWord(states: Readonly<Record<string, WordState>>): boolean {
  return Object.values(states).some((state) => state.kind === "learning");
}
