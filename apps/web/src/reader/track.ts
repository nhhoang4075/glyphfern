import { clampPage } from "@glyphfern/ui";

export const TRACK_SIDE_BORDER = 24;
export const TICK_MARKER_CLEARANCE = 22;

export interface TrackTick {
  chapter: number;
  fraction: number;
  done: boolean;
}

export function trackTicks(
  chapterStartPages: readonly number[],
  page: number,
  pages: number,
  innerWidth: number,
): TrackTick[] {
  if (pages <= 1) {
    return [];
  }
  const ticks: TrackTick[] = [];
  chapterStartPages.forEach((start, chapter) => {
    if (start === 0) {
      return;
    }
    const distance = (Math.abs(start - page) / (pages - 1)) * innerWidth;
    if (distance < TICK_MARKER_CLEARANCE) {
      return;
    }
    ticks.push({ chapter, fraction: start / (pages - 1), done: start <= page });
  });
  return ticks;
}

export function seekPage(
  clientX: number,
  trackLeft: number,
  trackWidth: number,
  pages: number,
): number {
  const span = trackWidth - TRACK_SIDE_BORDER * 2;
  if (span <= 0 || pages <= 1) {
    return 0;
  }
  const ratio = (clientX - trackLeft - TRACK_SIDE_BORDER) / span;
  return clampPage(Math.round(ratio * (pages - 1)), pages);
}
