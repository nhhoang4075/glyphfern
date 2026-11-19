import { describe, expect, test } from "bun:test";
import { createApi, push, useKeys } from "./sync-support";

useKeys();

const SCHEDULE = {
  due: 1,
  stability: 1,
  difficulty: 1,
  elapsedDays: 0,
  scheduledDays: 0,
  learningSteps: 0,
  reps: 1,
  lapses: 0,
  state: 1,
  lastReview: null,
};

function record(kind: string, key: string, payload: unknown, extra: object = {}) {
  return { kind, key, payload, updatedAt: 10, deleted: false, ...extra };
}

const validRecords = [
  record("wordState", "es:casa", { kind: "learning", level: 2 }),
  record("wordState", "es:perro", { kind: "known" }),
  record("card", "es:casa", { lemma: "casa", sentenceId: 3, schedule: SCHEDULE }),
  record("card", "es:gato", { lemma: "gato", sentenceId: 4 }),
  record("review", "es:5:casa", {
    lemma: "casa",
    sentenceId: 3,
    rating: "good",
    reviewedAt: 5,
    before: null,
    after: SCHEDULE,
    lang: "es",
  }),
  record("bookmarks", "es", { sentenceIds: [1, 2, 3] }),
  record("pins", "all", { bookIds: ["b1", "b2"] }),
  record("preferences", "main", {
    size: 18,
    lh: 1.62,
    font: "serif",
    paper: "#FCFBF9",
    turn: "slide",
    hl: 1,
    voice: "system",
  }),
  record("position", "book-1", { sentenceId: 1_000_042 }),
];

describe("POST /sync/push validation", () => {
  test("every valid kind is accepted and comes back on pull", async () => {
    const api = await createApi();
    const response = await push(api, api.owner, validRecords);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { accepted: number; cursor: number };
    expect(body.accepted).toBe(validRecords.length);
    const pulled = await api.call("/sync/pull", api.owner);
    const page = (await pulled.json()) as {
      records: { kind: string; seq: number }[];
      more: boolean;
      cursor: number;
      books: unknown[];
    };
    expect(page.records).toHaveLength(validRecords.length);
    expect(page.more).toBe(false);
    expect(page.cursor).toBe(body.cursor);
    expect(page.books).toEqual([]);
  });

  const invalid: [string, unknown][] = [
    ["an unknown kind", record("nope", "x", {})],
    ["a wordState key without a language", record("wordState", "casa", { kind: "known" })],
    [
      "a wordState key with an unsupported language",
      record("wordState", "fr:casa", { kind: "known" }),
    ],
    ["a wordState with an empty lemma", record("wordState", "es:", { kind: "known" })],
    [
      "a learning state with a bad level",
      record("wordState", "es:a", { kind: "learning", level: 4 }),
    ],
    ["a card without a sentence id", record("card", "es:a", { lemma: "a" })],
    [
      "a card with a malformed schedule",
      record("card", "es:a", { lemma: "a", sentenceId: 1, schedule: { due: 1 } }),
    ],
    ["a review key without a timestamp", record("review", "es:casa", { lemma: "casa" })],
    [
      "a review key with a non numeric timestamp",
      record("review", "es:x:casa", validRecords[4]?.payload),
    ],
    [
      "a review without a language",
      record("review", "es:5:casa", { ...(validRecords[4]?.payload as object), lang: "fr" }),
    ],
    ["a deleted review", record("review", "es:5:casa", null, { deleted: true })],
    ["bookmarks with the wrong key", record("bookmarks", "fr", { sentenceIds: [] })],
    ["bookmarks with a non integer id", record("bookmarks", "es", { sentenceIds: [1.5] })],
    [
      "bookmarks with too many ids",
      record("bookmarks", "es", { sentenceIds: Array.from({ length: 5001 }, (_, i) => i) }),
    ],
    ["pins with the wrong key", record("pins", "main", { bookIds: [] })],
    ["pins with a bad book id", record("pins", "all", { bookIds: ["bad id"] })],
    ["preferences with the wrong key", record("preferences", "x", validRecords[7]?.payload)],
    [
      "preferences with a bad paper",
      record("preferences", "main", { ...(validRecords[7]?.payload as object), paper: "red" }),
    ],
    ["a position with a bad book id", record("position", "bad/id", { sentenceId: 1 })],
    ["a position with a negative sentence id", record("position", "b1", { sentenceId: -1 })],
    ["a tombstone with a payload", record("position", "b1", { sentenceId: 1 }, { deleted: true })],
    ["a live record without a payload", record("position", "b1", null)],
    [
      "a missing updatedAt",
      { kind: "position", key: "b1", payload: { sentenceId: 1 }, deleted: false },
    ],
    [
      "a missing deleted flag",
      { kind: "position", key: "b1", payload: { sentenceId: 1 }, updatedAt: 1 },
    ],
    ["a non object record", "text"],
  ];
  for (const [name, bad] of invalid) {
    test(`${name} answers 400 invalid_record and writes nothing`, async () => {
      const api = await createApi();
      const response = await push(api, api.owner, [
        record("position", "ok", { sentenceId: 1 }),
        bad,
      ]);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "invalid_record" });
      const page = (await (await api.call("/sync/pull", api.owner)).json()) as {
        records: unknown[];
      };
      expect(page.records).toHaveLength(0);
    });
  }

  test("more than 500 records is invalid and exactly 500 is fine", async () => {
    const api = await createApi();
    const make = (count: number) =>
      Array.from({ length: count }, (_, i) => record("position", `b${i}`, { sentenceId: i }));
    expect((await push(api, api.owner, make(501))).status).toBe(400);
    expect((await push(api, api.owner, make(500))).status).toBe(200);
  });

  test("a body over 1 MB answers 413 and a non JSON body 400", async () => {
    const api = await createApi();
    const big = "x".repeat(1024 * 1024 + 1);
    const huge = await api.call("/sync/push", api.owner, {
      method: "POST",
      headers: { "content-length": String(big.length) },
      body: big,
    });
    expect(huge.status).toBe(413);
    const bad = await api.call("/sync/push", api.owner, {
      method: "POST",
      headers: { "content-length": "3" },
      body: "{{{",
    });
    expect(bad.status).toBe(400);
  });

  test("an older push is ignored while a newer one replaces the record", async () => {
    const api = await createApi();
    await push(api, api.owner, [record("position", "b1", { sentenceId: 1 }, { updatedAt: 100 })]);
    const stale = await push(api, api.owner, [
      record("position", "b1", { sentenceId: 2 }, { updatedAt: 99 }),
    ]);
    expect(((await stale.json()) as { accepted: number }).accepted).toBe(0);
    const fresh = await push(api, api.owner, [
      record("position", "b1", { sentenceId: 3 }, { updatedAt: 101 }),
    ]);
    expect(((await fresh.json()) as { accepted: number }).accepted).toBe(1);
    const page = (await (await api.call("/sync/pull", api.owner)).json()) as {
      records: { payload: unknown }[];
    };
    expect(page.records[0]?.payload).toEqual({ sentenceId: 3 });
  });
});

describe("GET /sync/pull", () => {
  test("since and limit page through records in seq order", async () => {
    const api = await createApi();
    const records = Array.from({ length: 5 }, (_, i) =>
      record("position", `b${i}`, { sentenceId: i }),
    );
    await push(api, api.owner, records);
    type Page = { records: { key: string; seq: number }[]; cursor: number; more: boolean };
    const first = (await (await api.call("/sync/pull?since=0&limit=2", api.owner)).json()) as Page;
    expect(first.records.map((r) => r.key)).toEqual(["b0", "b1"]);
    expect(first.more).toBe(true);
    expect(first.cursor).toBe(first.records[1]?.seq as number);
    const second = (await (
      await api.call(`/sync/pull?since=${first.cursor}&limit=2`, api.owner)
    ).json()) as Page;
    expect(second.records.map((r) => r.key)).toEqual(["b2", "b3"]);
    const last = (await (
      await api.call(`/sync/pull?since=${second.cursor}&limit=2`, api.owner)
    ).json()) as Page;
    expect(last.records.map((r) => r.key)).toEqual(["b4"]);
    expect(last.more).toBe(false);
  });

  test("bad since or limit answer 400 invalid_query", async () => {
    const api = await createApi();
    for (const query of ["since=-1", "since=x", "limit=0", "limit=501", "limit=1.5"]) {
      const response = await api.call(`/sync/pull?${query}`, api.owner);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "invalid_query" });
    }
  });

  test("wrong methods answer 405", async () => {
    const api = await createApi();
    expect((await api.call("/sync/pull", api.owner, { method: "POST" })).status).toBe(405);
    expect((await api.call("/sync/push", api.owner)).status).toBe(405);
    expect((await api.call("/sync/other", api.owner)).status).toBe(404);
  });

  test("a second user sees none of the first user's records", async () => {
    const api = await createApi();
    await push(api, api.owner, [record("position", "b1", { sentenceId: 1 }, { updatedAt: 100 })]);
    const mine = (await (await api.call("/sync/pull", api.second)).json()) as {
      records: unknown[];
    };
    expect(mine.records).toHaveLength(0);
    await push(api, api.second, [record("position", "b1", { sentenceId: 9 }, { updatedAt: 500 })]);
    const owner = (await (await api.call("/sync/pull", api.owner)).json()) as {
      records: { payload: unknown }[];
    };
    expect(owner.records).toHaveLength(1);
    expect(owner.records[0]?.payload).toEqual({ sentenceId: 1 });
  });
});
