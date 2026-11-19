import {
  type Card,
  Rating as FsrsRating,
  State as FsrsState,
  type Grade,
  createEmptyCard,
  fsrs,
} from "ts-fsrs";
import type { Rating, WordState } from "./types";

export const NEW_CARDS_PER_DAY = 10;

const REQUEST_RETENTION = 0.9;
const LEVEL_2_MIN_STABILITY_DAYS = 3;
const LEVEL_1_MIN_STABILITY_DAYS = 14;
const KNOWN_MIN_STABILITY_DAYS = 60;

export type ScheduleState = 0 | 1 | 2 | 3;

export interface CardSchedule {
  due: number;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: ScheduleState;
  lastReview: number | null;
}

export interface ReviewLogEntry {
  lemma: string;
  sentenceId: number;
  rating: Rating;
  reviewedAt: number;
  before: CardSchedule | null;
  after: CardSchedule;
}

const scheduler = fsrs({ request_retention: REQUEST_RETENTION, enable_fuzz: false });

const GRADE_BY_RATING: Record<Rating, Grade> = {
  again: FsrsRating.Again,
  hard: FsrsRating.Hard,
  good: FsrsRating.Good,
  easy: FsrsRating.Easy,
};

function fromLibraryCard(card: Card): CardSchedule {
  return {
    due: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as ScheduleState,
    lastReview: card.last_review ? card.last_review.getTime() : null,
  };
}

function toLibraryCard(schedule: CardSchedule): Card {
  const card: Card = {
    due: new Date(schedule.due),
    stability: schedule.stability,
    difficulty: schedule.difficulty,
    elapsed_days: schedule.elapsedDays,
    scheduled_days: schedule.scheduledDays,
    learning_steps: schedule.learningSteps,
    reps: schedule.reps,
    lapses: schedule.lapses,
    state: schedule.state,
  };
  if (schedule.lastReview !== null) {
    card.last_review = new Date(schedule.lastReview);
  }
  return card;
}

export function newSchedule(now: number): CardSchedule {
  return fromLibraryCard(createEmptyCard(new Date(now)));
}

export function rateSchedule(
  schedule: CardSchedule | undefined,
  rating: Rating,
  now: number,
): CardSchedule {
  const current = schedule ?? newSchedule(now);
  const result = scheduler.next(toLibraryCard(current), new Date(now), GRADE_BY_RATING[rating]);
  return fromLibraryCard(result.card);
}

export function wordStateFromSchedule(schedule: CardSchedule): WordState {
  if (schedule.reps === 0 || schedule.state !== FsrsState.Review) {
    return { kind: "learning", level: 3 };
  }
  if (schedule.stability < LEVEL_2_MIN_STABILITY_DAYS) {
    return { kind: "learning", level: 3 };
  }
  if (schedule.stability < LEVEL_1_MIN_STABILITY_DAYS) {
    return { kind: "learning", level: 2 };
  }
  if (schedule.stability < KNOWN_MIN_STABILITY_DAYS) {
    return { kind: "learning", level: 1 };
  }
  return { kind: "known" };
}

export function isNewCard(schedule: CardSchedule | undefined): boolean {
  return schedule === undefined || schedule.reps === 0;
}

export function isDueCard(schedule: CardSchedule | undefined, now: number): boolean {
  return schedule === undefined || schedule.due <= now;
}

export function buildDueQueue(
  cards: ReadonlyArray<{ lemma: string; schedule?: CardSchedule }>,
  now: number,
  newCardsAlreadyToday: number,
): string[] {
  const newCardsAllowed = Math.max(0, NEW_CARDS_PER_DAY - newCardsAlreadyToday);
  const dueReviewed = cards
    .filter((card) => !isNewCard(card.schedule) && isDueCard(card.schedule, now))
    .sort((a, b) => (a.schedule?.due ?? 0) - (b.schedule?.due ?? 0));
  const fresh = cards.filter((card) => isNewCard(card.schedule)).slice(0, newCardsAllowed);
  return [...dueReviewed, ...fresh].map((card) => card.lemma);
}
