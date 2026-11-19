import { describe, expect, test } from "bun:test";
import type { WordState } from "../src/types";
import {
  highlightAlpha,
  onCardAdded,
  onCardRemoved,
  onRated,
  tapKnown,
  tapLearning,
  tapNew,
} from "../src/wordState";

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

  test("rating again leaves every state unchanged", () => {
    for (const state of ALL_STATES) {
      expect(onRated(state, "again")).toEqual(state);
    }
  });

  test("rating hard leaves every state unchanged", () => {
    for (const state of ALL_STATES) {
      expect(onRated(state, "hard")).toEqual(state);
    }
  });

  test("rating good moves level 3 to 2, 2 to 1 and 1 to known", () => {
    expect(onRated(LEARNING_3, "good")).toEqual(LEARNING_2);
    expect(onRated(LEARNING_2, "good")).toEqual(LEARNING_1);
    expect(onRated(LEARNING_1, "good")).toEqual(KNOWN);
  });

  test("rating easy sets known from every learning level", () => {
    expect(onRated(LEARNING_1, "easy")).toEqual(KNOWN);
    expect(onRated(LEARNING_2, "easy")).toEqual(KNOWN);
    expect(onRated(LEARNING_3, "easy")).toEqual(KNOWN);
  });
});

describe("rating outside the table keeps the state", () => {
  test("rating good on a new word keeps it new", () => {
    expect(onRated(NEW, "good")).toEqual(NEW);
  });

  test("rating easy sets known even on a new word", () => {
    expect(onRated(NEW, "easy")).toEqual(KNOWN);
  });

  test("rating good on a known word keeps it known", () => {
    expect(onRated(KNOWN, "good")).toEqual(KNOWN);
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
