import { describe, expect, test } from "bun:test";
import { packs } from "@glyphfern/languages";
import { indexBook } from "../app/bookIndex";
import { openTestRepository } from "../testSupport";
import { createRepository } from "./createRepository";
import { ensureLanguage } from "./seed";

const SPANISH_KNOWN_COUNT = 28;
const SPANISH_LEARNING = {
  leña: 3,
  borde: 2,
  roble: 2,
  enfermo: 1,
  recoger: 1,
  despacio: 1,
  conocer: 1,
};
const KOREAN_KNOWN = ["한", "가다", "있다", "집", "어디", "날"];
const KOREAN_LEARNING = { 늑대: 3, 줍다: 2, 지름길: 2, 꺾다: 1, 천천히: 1 };

function sentenceText(lang: "es" | "ko", sentenceId: number): string {
  const sentence = indexBook(packs[lang].book).byId.get(sentenceId);
  return (sentence?.tokens ?? []).map((t) => `${t.lead}${t.surf}${t.trail}`).join(" ");
}

describe("starter seeding per language", () => {
  test("Spanish first run seeds 28 known words, 7 learning levels and 7 cards", async () => {
    const { repository } = await openTestRepository();
    const snapshot = await ensureLanguage(repository, packs.es);

    const known = Object.values(snapshot.states).filter((state) => state.kind === "known");
    expect(known).toHaveLength(SPANISH_KNOWN_COUNT);
    for (const [lemma, level] of Object.entries(SPANISH_LEARNING)) {
      expect(snapshot.states[lemma]).toEqual({ kind: "learning", level });
    }
    expect(snapshot.states.niña).toEqual({ kind: "known" });
    expect(snapshot.cards.map((card) => card.lemma)).toEqual(Object.keys(SPANISH_LEARNING));
    expect(snapshot.bookmarks).toEqual([]);
  });

  test("starter cards point at the first sentence that contains the lemma", async () => {
    const { repository } = await openTestRepository();
    const snapshot = await ensureLanguage(repository, packs.es);
    const byLemma = Object.fromEntries(snapshot.cards.map((c) => [c.lemma, c.sentenceId]));

    expect(sentenceText("es", byLemma.leña ?? -1)).toBe(
      "Todas las mañanas, la niña salía a buscar leña.",
    );
    expect(sentenceText("es", byLemma.borde ?? -1)).toStartWith("Había una vez una niña");
    expect(sentenceText("es", byLemma.conocer ?? -1)).toContain("conocía");
  });

  test("Korean first run seeds its own known, learning and card sets", async () => {
    const { repository } = await openTestRepository();
    const snapshot = await ensureLanguage(repository, packs.ko);

    for (const lemma of KOREAN_KNOWN) {
      expect(snapshot.states[lemma]).toEqual({ kind: "known" });
    }
    for (const [lemma, level] of Object.entries(KOREAN_LEARNING)) {
      expect(snapshot.states[lemma]).toEqual({ kind: "learning", level });
    }
    expect(Object.keys(snapshot.states)).toHaveLength(
      KOREAN_KNOWN.length + Object.keys(KOREAN_LEARNING).length,
    );
    expect(snapshot.cards.map((card) => card.lemma)).toEqual(Object.keys(KOREAN_LEARNING));
  });

  test("languages never share state even for equal lemmas", async () => {
    const { repository } = await openTestRepository();
    await ensureLanguage(repository, packs.es);
    const korean = await ensureLanguage(repository, packs.ko);
    expect(korean.states.casa).toBeUndefined();
    expect(korean.cards.some((card) => card.lemma === "leña")).toBe(false);
  });

  test("seeding runs once: later edits survive a reload", async () => {
    const { name, repository } = await openTestRepository();
    await ensureLanguage(repository, packs.es);
    await repository.saveWordState("es", "leña", { kind: "known" });
    await repository.deleteCard("es", "borde");

    const reopened = await openTestRepository(name);
    const snapshot = await ensureLanguage(reopened.repository, packs.es);
    expect(snapshot.states.leña).toEqual({ kind: "known" });
    expect(snapshot.cards.some((card) => card.lemma === "borde")).toBe(false);
    expect(snapshot.cards).toHaveLength(6);
  });
});

describe("storage fallback", () => {
  test("an unavailable database falls back to a working in-memory repository", async () => {
    const repository = await createRepository(async () => {
      throw new Error("IndexedDB unavailable");
    });
    expect(repository.kind).toBe("memory");
    const snapshot = await ensureLanguage(repository, packs.ko);
    expect(snapshot.cards).toHaveLength(5);
  });
});
