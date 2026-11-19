import {
  type PageRange,
  chapterPageOf,
  clampPage,
  endPageOf,
  gapFor,
  pageCount,
  pageSentence,
  startPageOf,
  step,
} from "./geometry";

export interface SentenceRange extends PageRange {
  readonly id: string;
}

export interface Paginator {
  layout(anchorSentenceId?: string): void;
  go(page: number): void;
  current(): number;
  pages(): number;
  ranges(): readonly SentenceRange[];
  chapterStartPages(): ReadonlyMap<number, number>;
  sentenceOnCurrentPage(): string | null;
  dispose(): void;
}

export interface PaginatorElements {
  readonly flow: HTMLElement;
  readonly sheet: HTMLElement;
}

function measureSentence(
  element: HTMLElement,
  flowLeft: number,
  pageStep: number,
): SentenceRange | null {
  const rects = element.getClientRects();
  const first = rects[0];
  const last = rects[rects.length - 1];
  const id = element.dataset.s;
  if (!first || !last || id === undefined) return null;
  const startPage = startPageOf(first.left, flowLeft, pageStep);
  const endPage = endPageOf(last.right, flowLeft, pageStep, startPage);
  return { id, startPage, endPage };
}

function measureChapters(
  flow: HTMLElement,
  flowLeft: number,
  pageStep: number,
): Map<number, number> {
  const pagesByChapter = new Map<number, number>();
  for (const heading of flow.querySelectorAll<HTMLElement>("h2[data-ch]")) {
    const index = Number(heading.dataset.ch);
    const left = heading.getBoundingClientRect().left;
    pagesByChapter.set(index, chapterPageOf(left, flowLeft, pageStep));
  }
  return pagesByChapter;
}

const TURNING_ATTRIBUTE = "data-turning";

function trackTurning(flow: HTMLElement, sheet: HTMLElement): () => void {
  let running = 0;
  const isFlowTransform = (event: TransitionEvent) =>
    event.target === flow && event.propertyName === "transform";
  const started = (event: TransitionEvent) => {
    if (!isFlowTransform(event)) return;
    running += 1;
    sheet.setAttribute(TURNING_ATTRIBUTE, "");
  };
  const ended = (event: TransitionEvent) => {
    if (!isFlowTransform(event)) return;
    running = Math.max(0, running - 1);
    if (running === 0) sheet.removeAttribute(TURNING_ATTRIBUTE);
  };
  flow.addEventListener("transitionrun", started);
  flow.addEventListener("transitionend", ended);
  flow.addEventListener("transitioncancel", ended);
  return () => {
    flow.removeEventListener("transitionrun", started);
    flow.removeEventListener("transitionend", ended);
    flow.removeEventListener("transitioncancel", ended);
    sheet.removeAttribute(TURNING_ATTRIBUTE);
  };
}

export function createPaginator({ flow, sheet }: PaginatorElements): Paginator {
  const stopTrackingTurning = trackTurning(flow, sheet);
  let currentPage = 0;
  let pageTotal = 1;
  let pageStep = 0;
  let sentenceRanges: SentenceRange[] = [];
  let chapterPages = new Map<number, number>();

  function sentenceOnCurrentPage(): string | null {
    if (sentenceRanges.length === 0) return null;
    return sentenceRanges[pageSentence(sentenceRanges, currentPage)]?.id ?? null;
  }

  function go(page: number): void {
    currentPage = clampPage(page, pageTotal);
    flow.style.transform = `translateX(${-currentPage * pageStep}px)`;
  }

  function applyColumns(width: number, gap: number): void {
    flow.style.width = `${width}px`;
    flow.style.columnWidth = `${width}px`;
    flow.style.columnGap = `${gap}px`;
  }

  function measureSentences(flowLeft: number): SentenceRange[] {
    const measured: SentenceRange[] = [];
    for (const element of flow.querySelectorAll<HTMLElement>(".s[data-s]")) {
      const range = measureSentence(element, flowLeft, pageStep);
      if (range) measured.push(range);
    }
    return measured;
  }

  function layout(anchorSentenceId?: string): void {
    const width = sheet.clientWidth;
    if (!width) return;
    const anchorId = anchorSentenceId ?? sentenceOnCurrentPage();
    const gap = gapFor(width);
    pageStep = step(width, gap);
    applyColumns(width, gap);
    flow.style.transition = "none";
    flow.style.transform = "translateX(0)";
    pageTotal = pageCount(flow.scrollWidth, gap, pageStep);
    const flowLeft = flow.getBoundingClientRect().left;
    sentenceRanges = measureSentences(flowLeft);
    chapterPages = measureChapters(flow, flowLeft, pageStep);
    const anchored = sentenceRanges.find((range) => range.id === anchorId);
    currentPage = clampPage(anchored ? anchored.startPage : 0, pageTotal);
    flow.style.transform = `translateX(${-currentPage * pageStep}px)`;
    void flow.offsetWidth;
    flow.style.transition = "";
  }

  return {
    layout,
    go,
    current: () => currentPage,
    pages: () => pageTotal,
    ranges: () => sentenceRanges,
    chapterStartPages: () => chapterPages,
    sentenceOnCurrentPage,
    dispose: stopTrackingTurning,
  };
}
