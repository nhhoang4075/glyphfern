export interface PageRange {
  readonly startPage: number;
  readonly endPage: number;
}

const GAP_RATIO = 0.2;
const EDGE_TOLERANCE_PX = 2;

export function gapFor(width: number): number {
  return Math.round(width * GAP_RATIO);
}

export function step(width: number, gap: number): number {
  return width + gap;
}

export function pageCount(scrollWidth: number, gap: number, pageStep: number): number {
  return Math.max(1, Math.round((scrollWidth + gap) / pageStep));
}

export function startPageOf(rectLeft: number, flowLeft: number, pageStep: number): number {
  return Math.max(0, Math.floor((rectLeft - flowLeft + EDGE_TOLERANCE_PX) / pageStep));
}

export function endPageOf(
  rectRight: number,
  flowLeft: number,
  pageStep: number,
  startPage: number,
): number {
  return Math.max(startPage, Math.floor((rectRight - flowLeft - EDGE_TOLERANCE_PX) / pageStep));
}

export function chapterPageOf(headingLeft: number, flowLeft: number, pageStep: number): number {
  return Math.floor((headingLeft - flowLeft + EDGE_TOLERANCE_PX) / pageStep);
}

export function pageSentence(ranges: readonly PageRange[], page: number): number {
  const index = ranges.findIndex((range) => range.endPage >= page);
  return index === -1 ? 0 : index;
}

export function sentenceAtPage(ranges: readonly PageRange[], page: number): number {
  const index = ranges.findIndex((range) => range.endPage >= page && range.startPage <= page);
  return index === -1 ? 0 : index;
}

export function clampPage(page: number, pages: number): number {
  return Math.max(0, Math.min(pages - 1, page));
}

export function progressRatio(page: number, pages: number): number {
  return pages > 1 ? page / (pages - 1) : 0;
}
