export function chapterProgress(page: number, startPage: number, nextStartPage: number): number {
  const span = Math.max(1, nextStartPage - startPage);
  const fraction = (page + 1 - startPage) / span;
  return clamp(fraction, 0, 1);
}

export function nextChapterStartPage(
  chapterStartPages: readonly number[],
  chapterIndex: number,
  totalPages: number,
): number {
  const nextStart = chapterStartPages[chapterIndex + 1];
  return nextStart ?? totalPages;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
