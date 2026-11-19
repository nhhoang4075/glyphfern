import { describe, expect, test } from "bun:test";
import { rateReviewCard } from "@glyphfern/core";
import {
  EMPTY_SESSION,
  sessionWithQueue,
  startOfLocalDay,
  startSession,
} from "../../src/review/review-queue";

describe("review session", () => {
  test("starts empty before the queue is built", () => {
    expect(EMPTY_SESSION).toEqual({ queue: [], total: 0 });
  });

  test("a started session holds a copy of the queue and counts its cards", () => {
    const built = ["maison", "chat", "obscurcir"];
    const session = startSession(built);
    built.pop();
    expect(session).toEqual({ queue: ["maison", "chat", "obscurcir"], total: 3 });
  });

  test("rating changes the queue but keeps the total, so the session is never rebuilt", () => {
    let session = startSession(["a", "b", "c"]);
    session = sessionWithQueue(session, rateReviewCard(session.queue, "good"));
    expect(session).toEqual({ queue: ["b", "c"], total: 3 });
    session = sessionWithQueue(session, rateReviewCard(session.queue, "again"));
    expect(session).toEqual({ queue: ["c", "b"], total: 3 });
  });

  test("a lemma that left the queue does not come back inside the session", () => {
    let session = startSession(["a", "b", "c"]);
    const seen: string[] = [];
    while (session.queue.length > 0) {
      seen.push(session.queue[0] ?? "");
      session = sessionWithQueue(session, rateReviewCard(session.queue, "good"));
    }
    expect(seen).toEqual(["a", "b", "c"]);
    expect(session.queue).toEqual([]);
  });
});

describe("startOfLocalDay", () => {
  test("returns local midnight of the same calendar day", () => {
    const afternoon = new Date(2026, 5, 10, 15, 45, 12, 500).getTime();
    expect(startOfLocalDay(afternoon)).toBe(new Date(2026, 5, 10, 0, 0, 0, 0).getTime());
  });

  test("a time just after midnight belongs to the new day", () => {
    const justAfter = new Date(2026, 5, 11, 0, 0, 0, 1).getTime();
    expect(startOfLocalDay(justAfter)).toBe(new Date(2026, 5, 11).getTime());
  });

  test("local midnight maps to itself", () => {
    const midnight = new Date(2026, 5, 11).getTime();
    expect(startOfLocalDay(midnight)).toBe(midnight);
  });
});
