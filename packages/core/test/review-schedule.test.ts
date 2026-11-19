import { describe, expect, test } from "bun:test";
import {
  type CardSchedule,
  NEW_CARDS_PER_DAY,
  buildDueQueue,
  isDueCard,
  isNewCard,
  newSchedule,
  rateSchedule,
  wordStateFromSchedule,
} from "../src/review-schedule";
import type { Rating, WordState } from "../src/types";

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const NOW = Date.UTC(2026, 10, 19, 8, 0, 0);

const LEARNING_STATE = 1;
const REVIEW_STATE = 2;
const RELEARNING_STATE = 3;

function syntheticSchedule(overrides: Partial<CardSchedule>): CardSchedule {
  return {
    due: NOW,
    stability: 10,
    difficulty: 5,
    elapsedDays: 0,
    scheduledDays: 10,
    learningSteps: 0,
    reps: 5,
    lapses: 0,
    state: REVIEW_STATE,
    lastReview: NOW - DAY_MS,
    ...overrides,
  };
}

function graduate(startedAt: number): CardSchedule {
  const first = rateSchedule(undefined, "good", startedAt);
  return rateSchedule(first, "good", first.due);
}

describe("new schedule", () => {
  test("is state New, never reviewed and due at now", () => {
    const schedule = newSchedule(NOW);
    expect(schedule.state).toBe(0);
    expect(schedule.reps).toBe(0);
    expect(schedule.lapses).toBe(0);
    expect(schedule.due).toBe(NOW);
    expect(schedule.lastReview).toBeNull();
  });

  test("rating an undefined schedule equals rating a new schedule", () => {
    expect(rateSchedule(undefined, "good", NOW)).toEqual(
      rateSchedule(newSchedule(NOW), "good", NOW),
    );
  });
});

describe("rating", () => {
  test("again on a new card is due minutes later, not days", () => {
    const schedule = rateSchedule(undefined, "again", NOW);
    const delay = schedule.due - NOW;
    expect(delay).toBeGreaterThan(0);
    expect(delay).toBeLessThan(60 * MINUTE_MS);
    expect(schedule.state).toBe(LEARNING_STATE);
    expect(schedule.lastReview).toBe(NOW);
    expect(schedule.reps).toBe(1);
  });

  test("good on a new card stays in learning and is due after the first step", () => {
    const schedule = rateSchedule(undefined, "good", NOW);
    expect(schedule.state).toBe(LEARNING_STATE);
    expect(schedule.due - NOW).toBe(10 * MINUTE_MS);
  });

  test("again, hard, good and easy on a graduated card give increasing due times", () => {
    const graduated = graduate(NOW);
    const ratings: Rating[] = ["again", "hard", "good", "easy"];
    const dues = ratings.map((rating) => rateSchedule(graduated, rating, graduated.due).due);
    expect(graduated.state).toBe(REVIEW_STATE);
    expect(dues[0] as number).toBeLessThan(dues[1] as number);
    expect(dues[1] as number).toBeLessThan(dues[2] as number);
    expect(dues[2] as number).toBeLessThan(dues[3] as number);
  });

  test("repeated good ratings at the due time increase stability", () => {
    let schedule = graduate(NOW);
    const stabilities = [schedule.stability];
    for (let round = 0; round < 4; round += 1) {
      schedule = rateSchedule(schedule, "good", schedule.due);
      stabilities.push(schedule.stability);
    }
    for (let index = 1; index < stabilities.length; index += 1) {
      expect(stabilities[index] as number).toBeGreaterThan(stabilities[index - 1] as number);
    }
  });

  test("again on a mature card relearns with lower stability and returns to learning level 3", () => {
    const mature = syntheticSchedule({
      stability: 70,
      scheduledDays: 70,
      reps: 12,
      due: NOW,
      lastReview: NOW - 70 * DAY_MS,
    });
    expect(wordStateFromSchedule(mature)).toEqual({ kind: "known" });
    const lapsed = rateSchedule(mature, "again", NOW);
    expect(lapsed.state).toBe(RELEARNING_STATE);
    expect(lapsed.stability).toBeLessThan(mature.stability);
    expect(lapsed.lapses).toBe(1);
    expect(wordStateFromSchedule(lapsed)).toEqual({ kind: "learning", level: 3 });
  });

  test("easy on a new card does not force known", () => {
    const schedule = rateSchedule(undefined, "easy", NOW);
    expect(wordStateFromSchedule(schedule)).not.toEqual({ kind: "known" });
  });

  test("is deterministic for identical inputs", () => {
    const graduated = graduate(NOW);
    const first = rateSchedule(graduated, "good", graduated.due);
    const second = rateSchedule(graduated, "good", graduated.due);
    expect(first).toEqual(second);
  });

  test("a schedule survives a JSON round trip after several ratings", () => {
    let schedule = rateSchedule(undefined, "again", NOW);
    const ratings: Rating[] = ["good", "good", "hard", "good", "easy"];
    for (const rating of ratings) {
      schedule = rateSchedule(schedule, rating, schedule.due);
    }
    const restored = JSON.parse(JSON.stringify(schedule)) as CardSchedule;
    expect(restored).toEqual(schedule);
    expect(rateSchedule(restored, "good", restored.due)).toEqual(
      rateSchedule(schedule, "good", schedule.due),
    );
  });
});

describe("word state from schedule", () => {
  const cases: Array<[number, WordState]> = [
    [2.99, { kind: "learning", level: 3 }],
    [3, { kind: "learning", level: 2 }],
    [13.99, { kind: "learning", level: 2 }],
    [14, { kind: "learning", level: 1 }],
    [59.99, { kind: "learning", level: 1 }],
    [60, { kind: "known" }],
  ];

  for (const [stability, expected] of cases) {
    test(`stability ${stability} in Review maps to ${JSON.stringify(expected)}`, () => {
      expect(wordStateFromSchedule(syntheticSchedule({ stability }))).toEqual(expected);
    });
  }

  test("stability 60 in Learning is learning level 3", () => {
    const schedule = syntheticSchedule({ stability: 60, state: LEARNING_STATE });
    expect(wordStateFromSchedule(schedule)).toEqual({ kind: "learning", level: 3 });
  });

  test("stability 60 in Relearning is learning level 3", () => {
    const schedule = syntheticSchedule({ stability: 60, state: RELEARNING_STATE });
    expect(wordStateFromSchedule(schedule)).toEqual({ kind: "learning", level: 3 });
  });

  test("a never reviewed schedule is learning level 3", () => {
    expect(wordStateFromSchedule(newSchedule(NOW))).toEqual({ kind: "learning", level: 3 });
  });

  test("a mid stability card in Relearning is learning level 3", () => {
    const schedule = syntheticSchedule({ stability: 20, state: RELEARNING_STATE });
    expect(wordStateFromSchedule(schedule)).toEqual({ kind: "learning", level: 3 });
  });
});

describe("card predicates", () => {
  test("a missing schedule is new and due", () => {
    expect(isNewCard(undefined)).toBe(true);
    expect(isDueCard(undefined, NOW)).toBe(true);
  });

  test("a schedule with zero reps is new", () => {
    expect(isNewCard(newSchedule(NOW))).toBe(true);
  });

  test("a reviewed schedule is not new", () => {
    expect(isNewCard(rateSchedule(undefined, "good", NOW))).toBe(false);
  });

  test("due is inclusive of now and excludes the future", () => {
    expect(isDueCard(syntheticSchedule({ due: NOW }), NOW)).toBe(true);
    expect(isDueCard(syntheticSchedule({ due: NOW - 1 }), NOW)).toBe(true);
    expect(isDueCard(syntheticSchedule({ due: NOW + 1 }), NOW)).toBe(false);
  });
});

describe("buildDueQueue", () => {
  const dueEarly = syntheticSchedule({ due: NOW - 3 * DAY_MS });
  const dueLate = syntheticSchedule({ due: NOW - DAY_MS });
  const future = syntheticSchedule({ due: NOW + DAY_MS });

  test("orders due reviewed cards by due ascending before new cards", () => {
    const queue = buildDueQueue(
      [
        { lemma: "new-a" },
        { lemma: "late", schedule: dueLate },
        { lemma: "early", schedule: dueEarly },
        { lemma: "new-b", schedule: newSchedule(NOW) },
      ],
      NOW,
      0,
    );
    expect(queue).toEqual(["early", "late", "new-a", "new-b"]);
  });

  test("breaks due ties by input order", () => {
    const tied = syntheticSchedule({ due: NOW - DAY_MS });
    const queue = buildDueQueue(
      [
        { lemma: "second", schedule: tied },
        { lemma: "first", schedule: syntheticSchedule({ due: NOW - 2 * DAY_MS }) },
        { lemma: "third", schedule: tied },
      ],
      NOW,
      0,
    );
    expect(queue).toEqual(["first", "second", "third"]);
  });

  test("excludes cards that are not due and not new", () => {
    const queue = buildDueQueue(
      [
        { lemma: "future", schedule: future },
        { lemma: "due", schedule: dueLate },
      ],
      NOW,
      0,
    );
    expect(queue).toEqual(["due"]);
  });

  test("limits new cards to the daily maximum in input order", () => {
    const cards = Array.from({ length: NEW_CARDS_PER_DAY + 5 }, (_, index) => ({
      lemma: `new-${index}`,
    }));
    const queue = buildDueQueue(cards, NOW, 0);
    expect(queue).toHaveLength(10);
    expect(queue).toEqual(cards.slice(0, 10).map((card) => card.lemma));
  });

  test("subtracts new cards already introduced today", () => {
    const cards = Array.from({ length: 8 }, (_, index) => ({ lemma: `new-${index}` }));
    expect(buildDueQueue(cards, NOW, 7)).toEqual(["new-0", "new-1", "new-2"]);
  });

  test("a used up limit admits no new cards but keeps due reviews", () => {
    const queue = buildDueQueue(
      [{ lemma: "new" }, { lemma: "due", schedule: dueLate }],
      NOW,
      NEW_CARDS_PER_DAY,
    );
    expect(queue).toEqual(["due"]);
  });

  test("an exceeded limit admits no new cards", () => {
    expect(buildDueQueue([{ lemma: "new" }], NOW, NEW_CARDS_PER_DAY + 4)).toEqual([]);
  });

  test("does not limit due reviewed cards", () => {
    const cards = Array.from({ length: 15 }, (_, index) => ({
      lemma: `due-${index}`,
      schedule: syntheticSchedule({ due: NOW - (index + 1) * MINUTE_MS }),
    }));
    expect(buildDueQueue(cards, NOW, 0)).toHaveLength(15);
  });
});
