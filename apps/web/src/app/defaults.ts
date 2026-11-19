import type { Preferences, TurnStyle } from "./api";

export const DEFAULT_SIZE = 21;
export const MIN_SIZE = 17;
export const MAX_SIZE = 28;

export function defaultTurnStyle(prefersReducedMotion: boolean): TurnStyle {
  return prefersReducedMotion ? "still" : "curl";
}

export function readPrefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function defaultPreferences(prefersReducedMotion: boolean): Preferences {
  return {
    size: DEFAULT_SIZE,
    lh: 1.62,
    font: "serif",
    paper: "#FCFBF9",
    turn: defaultTurnStyle(prefersReducedMotion),
    hl: 1,
    lang: "es",
    bookId: null,
  };
}
