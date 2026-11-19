import type { LearningLevel, WordState } from "./types";

const NEW_STATE: WordState = { kind: "new" };
const KNOWN_STATE: WordState = { kind: "known" };
const NEWEST_LEARNING_LEVEL: LearningLevel = 3;

const HIGHLIGHT_ALPHA_BY_LEVEL: Record<LearningLevel, number> = {
  1: 0.38,
  2: 0.6,
  3: 0.85,
};

const NO_HIGHLIGHT_ALPHA = 0;

export function tapNew(): WordState {
  return NEW_STATE;
}

export function tapLearning(state: WordState): WordState {
  if (state.kind === "learning") {
    return state;
  }
  return { kind: "learning", level: NEWEST_LEARNING_LEVEL };
}

export function tapKnown(): WordState {
  return KNOWN_STATE;
}

export function onCardAdded(state: WordState): WordState {
  if (state.kind === "new") {
    return { kind: "learning", level: NEWEST_LEARNING_LEVEL };
  }
  return state;
}

export function onCardRemoved(state: WordState): WordState {
  return state;
}

export function highlightAlpha(state: WordState): number {
  if (state.kind !== "learning") {
    return NO_HIGHLIGHT_ALPHA;
  }
  return HIGHLIGHT_ALPHA_BY_LEVEL[state.level];
}
