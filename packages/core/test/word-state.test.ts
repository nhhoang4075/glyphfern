import { describe, expect, test } from "bun:test";
import type { WordState } from "../src/types";
import {
  highlightAlpha,
  onCardAdded,
  onCardRemoved,
  tapKnown,
  tapLearning,
  tapNew,
} from "../src/word-state";

const NEW: WordState = { kind: "new" };
const KNOWN: WordState = { kind: "known" };
const LEARNING_1: WordState = { kind: "learning", level: 1 };
const LEARNING_2: WordState = { kind: "learning", level: 2 };
const LEARNING_3: WordState = { kind: "learning", level: 3 };
const ALL_STATES: WordState[] = [NEW, KNOWN, LEARNING_1, LEARNING_2, LEARNING_3];

describe("section 3 state table", () => {
  test("tap new removes the state", () => {
    expect(tapNew()).toEqual({ kind: "new" });
  });

  test("tap learning from new sets level 3", () => {
    expect(tapLearning(NEW)).toEqual({ kind: "learning", level: 3 });
  });

  test("tap learning from known sets level 3", () => {
    expect(tapLearning(KNOWN)).toEqual({ kind: "learning", level: 3 });
  });

  test("tap learning on an existing learning state keeps its level", () => {
    expect(tapLearning(LEARNING_1)).toEqual(LEARNING_1);
    expect(tapLearning(LEARNING_2)).toEqual(LEARNING_2);
    expect(tapLearning(LEARNING_3)).toEqual(LEARNING_3);
  });

  test("tap known sets known", () => {
    expect(tapKnown()).toEqual({ kind: "known" });
  });

  test("adding a card to a word with no state sets learning level 3", () => {
    expect(onCardAdded(NEW)).toEqual({ kind: "learning", level: 3 });
  });

  test("adding a card to a word that already has a state leaves it unchanged", () => {
    expect(onCardAdded(KNOWN)).toEqual(KNOWN);
    expect(onCardAdded(LEARNING_1)).toEqual(LEARNING_1);
    expect(onCardAdded(LEARNING_2)).toEqual(LEARNING_2);
  });

  test("removing a card leaves every state unchanged", () => {
    for (const state of ALL_STATES) {
      expect(onCardRemoved(state)).toEqual(state);
    }
  });
});

describe("highlight alpha", () => {
  test("learning levels map to 38, 60 and 85 percent", () => {
    expect(highlightAlpha(LEARNING_1)).toBe(0.38);
    expect(highlightAlpha(LEARNING_2)).toBe(0.6);
    expect(highlightAlpha(LEARNING_3)).toBe(0.85);
  });

  test("new and known words are not highlighted", () => {
    expect(highlightAlpha(NEW)).toBe(0);
    expect(highlightAlpha(KNOWN)).toBe(0);
  });
});
