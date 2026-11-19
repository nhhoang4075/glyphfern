import { describe, expect, test } from "bun:test";
import { esPack } from "@glyphfern/languages";
import { indexBook } from "../../src/app/book-index";
import {
  CLOSED_REVEAL,
  bookmarksOnPage,
  chapterRows,
  escapeAction,
  groupMembers,
  groupSurface,
  hasLearningWord,
  highlightClass,
  isRevealOpen,
  noteSegments,
  popoverPlacement,
  searchHits,
  sentenceText,
  showsLemmaChip,
  toggleReveal,
} from "../../src/reader/reader-logic";
import { parseSentenceKey, sentenceKey } from "../../src/reader/sentence-key";

describe("reveal state", () => {
  test("starts closed and toggles each block independently", () => {
    expect(isRevealOpen(CLOSED_REVEAL)).toBe(false);
    const translated = toggleReveal(CLOSED_REVEAL, "translation");
    expect(translated).toEqual({ translation: true, grammar: false });
    const both = toggleReveal(translated, "grammar");
    expect(isRevealOpen(both)).toBe(true);
    expect(toggleReveal(both, "translation")).toEqual({ translation: false, grammar: true });
  });
});

describe("escapeAction", () => {
  test("closes every open layer at once and leaves fullscreen only when none was open", () => {
    const all = { popover: true, drawer: true, panel: true, fullscreen: true };
    expect(escapeAction(all)).toBe("closeLayers");
    expect(escapeAction({ ...all, popover: false, drawer: false })).toBe("closeLayers");
    expect(escapeAction({ ...all, popover: false })).toBe("closeLayers");
    expect(escapeAction({ popover: false, drawer: false, panel: false, fullscreen: true })).toBe(
      "exitFullscreen",
    );
    expect(escapeAction({ popover: false, drawer: false, panel: false, fullscreen: false })).toBe(
      "none",
    );
  });
});

describe("popoverPlacement", () => {
  test("aligns the right edge with the button and sits 4px below it", () => {
    expect(popoverPlacement({ right: 1170, bottom: 53 }, { right: 1184, top: 0 })).toEqual({
      right: 14,
      top: 57,
    });
  });

  test("subtracts the parent top and keeps 8px from the edge", () => {
    expect(popoverPlacement({ right: 995, bottom: 80 }, { right: 1000, top: 10 })).toEqual({
      right: 8,
      top: 74,
    });
  });
});

describe("chapterRows", () => {
  test("uses clamp((page + 1 - start) / (nextStart - start), 0, 1)", () => {
    const rows = chapterRows([0, 4, 8], 5, 12, 1);
    expect(rows.map((row) => row.fraction)).toEqual([1, 0.5, 0]);
    expect(rows.map((row) => row.current)).toEqual([false, true, false]);
  });

  test("the last chapter ends at the total page count", () => {
    const rows = chapterRows([0, 4, 8], 9, 12, 2);
    expect(rows[2]?.fraction).toBe(0.5);
  });
});

describe("bookmarksOnPage", () => {
  const spans = [
    { id: 1, startPage: 0, endPage: 0 },
    { id: 2, startPage: 0, endPage: 1 },
    { id: 3, startPage: 1, endPage: 1 },
  ];

  test("finds bookmarked sentences that touch the page", () => {
    expect(bookmarksOnPage(spans, [2], 1)).toEqual([2]);
    expect(bookmarksOnPage(spans, [2], 0)).toEqual([2]);
    expect(bookmarksOnPage(spans, [1], 1)).toEqual([]);
  });

  test("ignores sentences that are not bookmarked", () => {
    expect(bookmarksOnPage(spans, [], 0)).toEqual([]);
  });
});

describe("sentence keys", () => {
  test("round trips numeric ids and rejects anything else", () => {
    expect(sentenceKey(12)).toBe("12");
    expect(parseSentenceKey("12")).toBe(12);
    expect(parseSentenceKey("0")).toBe(0);
    expect(parseSentenceKey("")).toBeNull();
    expect(parseSentenceKey("1a")).toBeNull();
    expect(parseSentenceKey(undefined)).toBeNull();
  });
});

describe("searchHits", () => {
  const { sentences } = indexBook(esPack.book);

  test("marks the matching tokens of each sentence", () => {
    const hits = searchHits(sentences, "lobo");
    expect(hits.length).toBeGreaterThan(0);
    for (const hit of hits) {
      const sentence = sentences.find((candidate) => candidate.id === hit.sentenceId);
      expect(sentence).toBeDefined();
      sentence?.tokens.forEach((token, index) => {
        const matches = [token.lemma, token.surf].some((value) =>
          value.toLowerCase().startsWith("lobo"),
        );
        expect(hit.parts[index]?.marked).toBe(matches);
      });
    }
  });

  test("matches by lemma and keeps lead and trail in the text", () => {
    const hits = searchHits(sentences, "vivir");
    const first = hits[0];
    expect(first?.parts.some((part) => part.marked && part.text === "vivía")).toBe(true);
    expect(first?.parts.at(-1)?.text.endsWith(".")).toBe(true);
  });

  test("returns nothing for an empty query", () => {
    expect(searchHits(sentences, "  ")).toEqual([]);
  });
});

describe("group helpers", () => {
  const se = esPack.book.chapters
    .flatMap((chapter) => chapter.paragraphs.flat())
    .find((sentence) => sentence.tokens.some((token) => token.group));

  test("a grouped token selects every member and joins their surfaces", () => {
    expect(se).toBeDefined();
    if (!se) return;
    const first = se.tokens.findIndex((token) => token.group);
    const members = groupMembers(se, first);
    expect(members.length).toBe(2);
    expect(groupSurface(se, first)).toBe("se fue");
    expect(groupMembers(se, members[1] ?? 0)).toEqual(members);
  });

  test("a plain token is its own group", () => {
    expect(se && groupMembers(se, 0)).toEqual([0]);
  });

  test("lemma chip appears only when the lemma differs from the lowercase surface", () => {
    expect(showsLemmaChip("lobo", "Lobo")).toBe(false);
    expect(showsLemmaChip("irse", "se fue")).toBe(true);
  });

  test("sentence text joins tokens with lead and trail by single spaces", () => {
    const sentence = esPack.book.chapters[0]?.paragraphs[0]?.[0];
    expect(sentence && sentenceText(sentence).startsWith("Había una vez")).toBe(true);
    expect(sentence && sentenceText(sentence).endsWith("bosque.")).toBe(true);
  });
});

describe("word state helpers", () => {
  test("highlight class follows the learning level only", () => {
    expect(highlightClass({ kind: "learning", level: 3 })).toBe("l3");
    expect(highlightClass({ kind: "learning", level: 1 })).toBe("l1");
    expect(highlightClass({ kind: "known" })).toBe("");
    expect(highlightClass({ kind: "new" })).toBe("");
  });

  test("the dock dot shows when any word is learning", () => {
    expect(hasLearningWord({ a: { kind: "known" } })).toBe(false);
    expect(hasLearningWord({ a: { kind: "known" }, b: { kind: "learning", level: 2 } })).toBe(true);
  });
});

describe("noteSegments", () => {
  test("splits bold and italic markup into flagged segments", () => {
    expect(noteSegments("<b>fue</b> es de <i>ser</i> o ir.")).toEqual([
      { text: "fue", bold: true, italic: false },
      { text: " es de ", bold: false, italic: false },
      { text: "ser", bold: false, italic: true },
      { text: " o ir.", bold: false, italic: false },
    ]);
  });

  test("plain text is a single segment", () => {
    expect(noteSegments("hola")).toEqual([{ text: "hola", bold: false, italic: false }]);
  });
});
