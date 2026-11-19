export interface ChapterWindow {
  first: number;
  last: number;
}

export function chapterWindow(center: number, chapterCount: number): ChapterWindow {
  const last = Math.max(0, chapterCount - 1);
  const clamped = Math.min(last, Math.max(0, center));
  return { first: Math.max(0, clamped - 1), last: Math.min(last, clamped + 1) };
}

export function windowWords(wordCounts: readonly number[], window: ChapterWindow): number {
  return wordCounts.slice(window.first, window.last + 1).reduce((sum, count) => sum + count, 0);
}

export function hasChapterAfter(window: ChapterWindow, chapterCount: number): boolean {
  return window.last < chapterCount - 1;
}

export function hasChapterBefore(window: ChapterWindow): boolean {
  return window.first > 0;
}
