import { describe, expect, test } from "bun:test";
import { type Lang, type ReviewLogEntry, rateSchedule } from "@glyphfern/core";
import { MemoryRepository } from "../../src/storage/memory-repository";
import type { Repository } from "../../src/storage/repository";
import { openTestRepository } from "../../src/test-support";

const NOON = new Date(2026, 5, 10, 12, 0, 0).getTime();
const HOUR = 3_600_000;
const OTHER_LANG = "ko" as unknown as Lang;

function firstReview(lemma: string, reviewedAt: number): ReviewLogEntry {
  return {
    lemma,
    sentenceId: 1,
    rating: "good",
    reviewedAt,
    before: null,
    after: rateSchedule(undefined, "good", reviewedAt),
  };
}

function laterReview(lemma: string, reviewedAt: number): ReviewLogEntry {
  const before = rateSchedule(undefined, "good", reviewedAt - HOUR);
  return {
    lemma,
    sentenceId: 1,
    rating: "good",
    reviewedAt,
    before,
    after: rateSchedule(before, "good", reviewedAt),
  };
}

const FACTORIES: Array<[string, () => Promise<Repository>]> = [
  ["memory", async () => new MemoryRepository()],
  ["dexie", async () => (await openTestRepository()).repository],
];

for (const [name, create] of FACTORIES) {
  describe(`${name} repository cards`, () => {
    test("saveCard persists the schedule and loadLanguage returns it", async () => {
      const repository = await create();
      const schedule = rateSchedule(undefined, "good", NOON);
      await repository.saveCard("es", { lemma: "leña", sentenceId: 2, schedule });
      const { cards } = await repository.loadLanguage("es");
      expect(cards).toEqual([{ lemma: "leña", sentenceId: 2, schedule }]);
    });

    test("a card saved without a schedule loads without one", async () => {
      const repository = await create();
      await repository.saveCard("es", { lemma: "leña", sentenceId: 2 });
      const { cards } = await repository.loadLanguage("es");
      expect(cards).toEqual([{ lemma: "leña", sentenceId: 2 }]);
      expect("schedule" in (cards[0] ?? {})).toBe(false);
    });

    test("saving a card again replaces its schedule and keeps its position", async () => {
      const repository = await create();
      await repository.saveCard("es", { lemma: "a", sentenceId: 1 });
      await repository.saveCard("es", { lemma: "b", sentenceId: 2 });
      const schedule = rateSchedule(undefined, "easy", NOON);
      await repository.saveCard("es", { lemma: "a", sentenceId: 1, schedule });
      const { cards } = await repository.loadLanguage("es");
      expect(cards).toEqual([
        { lemma: "a", sentenceId: 1, schedule },
        { lemma: "b", sentenceId: 2 },
      ]);
    });
  });

  describe(`${name} repository review log`, () => {
    test("appendReview stores entries and loadReviewLog returns them ordered by time", async () => {
      const repository = await create();
      const late = firstReview("b", NOON + HOUR);
      const early = firstReview("a", NOON);
      await repository.appendReview("es", late);
      await repository.appendReview("es", early);
      expect(await repository.loadReviewLog("es")).toEqual([early, late]);
    });

    test("entries with the same time keep their append order", async () => {
      const repository = await create();
      await repository.appendReview("es", firstReview("a", NOON));
      await repository.appendReview("es", firstReview("b", NOON));
      const lemmas = (await repository.loadReviewLog("es")).map((entry) => entry.lemma);
      expect(lemmas).toEqual(["a", "b"]);
    });

    test("the log of each stored language key is separate", async () => {
      const repository = await create();
      await repository.appendReview("es", firstReview("leña", NOON));
      await repository.appendReview(OTHER_LANG, firstReview("늑대", NOON));
      const es = await repository.loadReviewLog("es");
      const ko = await repository.loadReviewLog(OTHER_LANG);
      expect(es.map((entry) => entry.lemma)).toEqual(["leña"]);
      expect(ko.map((entry) => entry.lemma)).toEqual(["늑대"]);
    });

    test("loaded entries carry no storage fields", async () => {
      const repository = await create();
      const entry = firstReview("leña", NOON);
      await repository.appendReview("es", entry);
      const [loaded] = await repository.loadReviewLog("es");
      expect(Object.keys(loaded ?? {}).sort()).toEqual(Object.keys(entry).sort());
    });

    test("deleting a card never deletes its log entries", async () => {
      const repository = await create();
      await repository.saveCard("es", { lemma: "leña", sentenceId: 2 });
      await repository.appendReview("es", firstReview("leña", NOON));
      await repository.deleteCard("es", "leña");
      expect(await repository.loadReviewLog("es")).toHaveLength(1);
    });

    test("countNewReviewsSince counts first reviews: before null or reps 0", async () => {
      const repository = await create();
      const unreviewed = rateSchedule(undefined, "good", NOON);
      const zeroReps = { ...unreviewed, reps: 0 };
      await repository.appendReview("es", firstReview("a", NOON));
      await repository.appendReview("es", {
        ...laterReview("b", NOON + HOUR),
        before: zeroReps,
      });
      await repository.appendReview("es", laterReview("a", NOON + 2 * HOUR));
      expect(await repository.countNewReviewsSince("es", NOON)).toBe(2);
    });

    test("countNewReviewsSince includes the boundary and excludes earlier entries", async () => {
      const repository = await create();
      await repository.appendReview("es", firstReview("a", NOON - 1));
      await repository.appendReview("es", firstReview("b", NOON));
      await repository.appendReview("es", firstReview("c", NOON + 1));
      expect(await repository.countNewReviewsSince("es", NOON)).toBe(2);
      expect(await repository.countNewReviewsSince("es", NOON + 2)).toBe(0);
    });

    test("countNewReviewsSince counts only the asked language", async () => {
      const repository = await create();
      const languages: Lang[] = ["es", OTHER_LANG, "es"];
      for (const [index, lang] of languages.entries()) {
        await repository.appendReview(lang, firstReview(`w${index}`, NOON + index));
      }
      expect(await repository.countNewReviewsSince("es", NOON)).toBe(2);
      expect(await repository.countNewReviewsSince(OTHER_LANG, NOON)).toBe(1);
    });
  });
}
