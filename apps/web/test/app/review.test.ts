import { describe, expect, test } from "bun:test";
import {
  type CardSchedule,
  NEW_CARDS_PER_DAY,
  rateSchedule,
  wordStateFromSchedule,
} from "@glyphfern/core";
import { AppStore } from "../../src/app/store";
import { MemoryRepository } from "../../src/storage/memory-repository";
import { openTestRepository } from "../../src/test-support";

const DAY = 86_400_000;
const TODAY_NOON = new Date(2026, 5, 10, 12, 0, 0).getTime();
const TOMORROW_AFTER_MIDNIGHT = new Date(2026, 5, 11, 0, 30, 0).getTime();
const CARD_LEMMAS = ["leña", "borde", "roble", "enfermo", "recoger", "despacio", "conocer"];
const CARD_LEVELS = [3, 2, 2, 1, 1, 1, 1];

interface Clock {
  time: number;
  now(): number;
}

function createClock(time: number): Clock {
  const clock: Clock = { time, now: () => clock.time };
  return clock;
}

async function openStore(repository: MemoryRepository, clock: Clock) {
  return AppStore.open(repository, {
    prefersReducedMotion: false,
    initialRoute: "review",
    now: clock.now,
  });
}

function cardOf(store: AppStore, lemma: string) {
  return store.getApi().state.cards.find((card) => card.lemma === lemma);
}

function matureSchedule(now: number): CardSchedule {
  return {
    due: now - DAY,
    stability: 70,
    difficulty: 5,
    elapsedDays: 70,
    scheduledDays: 70,
    learningSteps: 0,
    reps: 6,
    lapses: 0,
    state: 2,
    lastReview: now - 70 * DAY,
  };
}

async function seededRepository(
  schedules: Record<string, CardSchedule> = {},
): Promise<MemoryRepository> {
  const repository = new MemoryRepository();
  await repository.saveWordState("es", "casa", { kind: "known" });
  for (const [index, lemma] of CARD_LEMMAS.entries()) {
    const schedule = schedules[lemma];
    await repository.saveCard("es", {
      lemma,
      sentenceId: index + 2,
      ...(schedule ? { schedule } : {}),
    });
    await repository.saveWordState("es", lemma, {
      kind: "learning",
      level: CARD_LEVELS[index] ?? 1,
    });
  }
  return repository;
}

async function openSeededStore(
  clock: Clock,
  schedules: Record<string, CardSchedule> = {},
): Promise<{ store: AppStore; repository: MemoryRepository }> {
  const repository = await seededRepository(schedules);
  return { store: await openStore(repository, clock), repository };
}

function rateAllGood(store: AppStore, queue: string[]) {
  let remaining = queue;
  while (remaining.length > 0) {
    remaining = store.actions.rateCard(remaining, "good");
  }
}

describe("rating a card", () => {
  test("a new card gets a schedule, a log entry and the derived word state", async () => {
    const clock = createClock(TODAY_NOON);
    const { store, repository } = await openSeededStore(clock);
    const card = cardOf(store, "borde");
    expect(card?.schedule).toBeUndefined();

    expect(store.actions.rateCard(["borde"], "good")).toEqual([]);
    await store.settled();

    const rated = cardOf(store, "borde");
    const expected = rateSchedule(undefined, "good", TODAY_NOON);
    expect(rated?.schedule).toEqual(expected);
    expect(store.getApi().stateOf("borde")).toEqual(wordStateFromSchedule(expected));
    expect(store.getApi().stateOf("borde")).toEqual({ kind: "learning", level: 3 });
    expect(await repository.loadReviewLog("es")).toEqual([
      {
        lemma: "borde",
        sentenceId: card?.sentenceId ?? -1,
        rating: "good",
        reviewedAt: TODAY_NOON,
        before: null,
        after: expected,
      },
    ]);
    const reloaded = await repository.loadLanguage("es");
    expect(reloaded.cards.find((candidate) => candidate.lemma === "borde")?.schedule).toEqual(
      expected,
    );
    expect(reloaded.states.borde).toEqual({ kind: "learning", level: 3 });
  });

  test("easy on a new card does not make the word known by itself", async () => {
    const { store } = await openSeededStore(createClock(TODAY_NOON));
    store.actions.rateCard(["enfermo"], "easy");
    const schedule = cardOf(store, "enfermo")?.schedule;
    expect(schedule).toBeDefined();
    expect(store.getApi().stateOf("enfermo").kind).toBe("learning");
    expect(store.getApi().stateOf("enfermo")).toEqual(
      wordStateFromSchedule(rateSchedule(undefined, "easy", TODAY_NOON)),
    );
  });

  test("again on a mature card in state Review returns the word to learning level 3", async () => {
    const clock = createClock(TODAY_NOON);
    const mature = matureSchedule(TODAY_NOON);
    const { store, repository } = await openSeededStore(clock, { enfermo: mature });
    store.actions.setWordState("enfermo", "known");
    expect(store.getApi().stateOf("enfermo")).toEqual({ kind: "known" });

    store.actions.rateCard(["enfermo"], "again");
    await store.settled();

    expect(store.getApi().stateOf("enfermo")).toEqual({ kind: "learning", level: 3 });
    const [entry] = await repository.loadReviewLog("es");
    expect(entry?.before).toEqual(mature);
    expect(entry?.after.lapses).toBe(1);
    expect(entry?.after.stability).toBeLessThan(mature.stability);
  });

  test("good on a mature card keeps stability high and the word known", async () => {
    const clock = createClock(TODAY_NOON);
    const { store } = await openSeededStore(clock, { enfermo: matureSchedule(TODAY_NOON) });
    store.actions.rateCard(["enfermo"], "good");
    expect(store.getApi().stateOf("enfermo")).toEqual({ kind: "known" });
  });

  test("a word without a card is never touched and nothing is logged", async () => {
    const { store, repository } = await openSeededStore(createClock(TODAY_NOON));
    expect(store.getApi().stateOf("casa")).toEqual({ kind: "known" });
    expect(cardOf(store, "casa")).toBeUndefined();

    expect(store.actions.rateCard(["casa", "borde"], "easy")).toEqual(["borde"]);
    await store.settled();

    expect(store.getApi().stateOf("casa")).toEqual({ kind: "known" });
    expect(await repository.loadReviewLog("es")).toEqual([]);
  });

  test("rating keeps the order of the cards", async () => {
    const { store } = await openSeededStore(createClock(TODAY_NOON));
    const before = store.getApi().state.cards.map((card) => card.lemma);
    store.actions.rateCard([before[2] ?? ""], "good");
    expect(store.getApi().state.cards.map((card) => card.lemma)).toEqual(before);
  });

  test("the queue follows the session rules: again re-appends, hard reinserts at index 2", async () => {
    const { store } = await openSeededStore(createClock(TODAY_NOON));
    const queue = ["leña", "borde", "roble", "enfermo"];
    expect(store.actions.rateCard(queue, "again")).toEqual(["borde", "roble", "enfermo", "leña"]);
    expect(store.actions.rateCard(queue, "hard")).toEqual(["borde", "roble", "leña", "enfermo"]);
    expect(store.actions.rateCard(queue, "good")).toEqual(["borde", "roble", "enfermo"]);
    expect(store.actions.rateCard(queue, "easy")).toEqual(["borde", "roble", "enfermo"]);
    expect(store.actions.rateCard([], "good")).toEqual([]);
  });

  test("an again rating then a good rating of the same card counts as one new card", async () => {
    const clock = createClock(TODAY_NOON);
    const { store, repository } = await openSeededStore(clock);
    let queue = ["leña", "borde"];
    queue = store.actions.rateCard(queue, "again");
    expect(queue).toEqual(["borde", "leña"]);
    queue = store.actions.rateCard(queue, "good");
    queue = store.actions.rateCard(queue, "good");
    expect(queue).toEqual([]);
    await store.settled();

    const log = await repository.loadReviewLog("es");
    expect(log.map((entry) => entry.lemma)).toEqual(["leña", "borde", "leña"]);
    expect(log[2]?.before?.reps).toBe(1);
    expect(await repository.countNewReviewsSince("es", TODAY_NOON - 1000)).toBe(2);
  });

  test("removing a card keeps its log entries", async () => {
    const { store, repository } = await openSeededStore(createClock(TODAY_NOON));
    store.actions.rateCard(["leña"], "good");
    store.actions.removeCard("leña");
    await store.settled();
    expect(await repository.loadReviewLog("es")).toHaveLength(1);
  });
});

describe("startReview", () => {
  test("a legacy card without a schedule is a new card due now", async () => {
    const { store } = await openSeededStore(createClock(TODAY_NOON));
    expect(await store.actions.startReview()).toEqual(CARD_LEMMAS);
  });

  test("a card due in the future is excluded and a card due now is included", async () => {
    const clock = createClock(TODAY_NOON);
    const reviewed = rateSchedule(undefined, "good", TODAY_NOON - 5 * DAY);
    const dueNow: CardSchedule = { ...reviewed, due: TODAY_NOON };
    const dueLater: CardSchedule = { ...reviewed, due: TODAY_NOON + 1 };
    const { store } = await openSeededStore(clock, { leña: dueLater, borde: dueNow });

    const queue = await store.actions.startReview();

    expect(queue).not.toContain("leña");
    expect(queue[0]).toBe("borde");
    expect(queue.slice(1)).toEqual(["roble", "enfermo", "recoger", "despacio", "conocer"]);
  });

  test("new cards are limited to 10 per local day and allowed again after local midnight", async () => {
    const clock = createClock(TODAY_NOON);
    const { store } = await openSeededStore(clock);
    const extra = ["uno", "dos", "tres", "cuatro", "cinco"];
    for (const lemma of extra) {
      store.actions.addCard(lemma, 1);
    }
    expect(store.getApi().state.cards).toHaveLength(CARD_LEMMAS.length + extra.length);

    const first = await store.actions.startReview();
    expect(first).toHaveLength(NEW_CARDS_PER_DAY);
    rateAllGood(store, first);

    expect(await store.actions.startReview()).toEqual([]);

    clock.time = TOMORROW_AFTER_MIDNIGHT;
    const nextDay = await store.actions.startReview();
    const waiting = [...CARD_LEMMAS, ...extra].slice(NEW_CARDS_PER_DAY);
    expect(nextDay.slice(-waiting.length)).toEqual(waiting);
    expect(nextDay).toHaveLength(NEW_CARDS_PER_DAY + waiting.length);
  });

  test("cards removed or rated away do not reappear in a rebuilt queue before they are due", async () => {
    const clock = createClock(TODAY_NOON);
    const { store } = await openSeededStore(clock);
    store.actions.rateCard(["leña"], "good");
    store.actions.removeCard("borde");
    const queue = await store.actions.startReview();
    expect(queue).not.toContain("leña");
    expect(queue).not.toContain("borde");
  });
});

describe("review data through Dexie", () => {
  test("schedules and the review log survive a reload", async () => {
    const clock = createClock(TODAY_NOON);
    const { name, repository } = await openTestRepository();
    for (const [index, lemma] of CARD_LEMMAS.entries()) {
      await repository.saveCard("es", { lemma, sentenceId: index + 2 });
      await repository.saveWordState("es", lemma, {
        kind: "learning",
        level: CARD_LEVELS[index] ?? 1,
      });
    }
    const store = await AppStore.open(repository, {
      prefersReducedMotion: false,
      initialRoute: "review",
      now: clock.now,
    });
    store.actions.rateCard(["leña", "borde"], "good");
    store.actions.rateCard(["borde"], "hard");
    await store.settled();
    const rated = cardOf(store, "leña")?.schedule;

    const reopened = await openTestRepository(name);
    const next = await AppStore.open(reopened.repository, {
      prefersReducedMotion: false,
      initialRoute: "review",
      now: clock.now,
    });
    expect(cardOf(next, "leña")?.schedule).toEqual(rated);
    expect(cardOf(next, "roble")?.schedule).toBeUndefined();
    expect((await reopened.repository.loadReviewLog("es")).map((entry) => entry.lemma)).toEqual([
      "leña",
      "borde",
    ]);
    expect(next.getApi().stateOf("leña")).toEqual({ kind: "learning", level: 3 });
    expect(await next.actions.startReview()).not.toContain("leña");
  });
});
