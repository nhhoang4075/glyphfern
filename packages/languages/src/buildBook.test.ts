import { describe, expect, test } from "bun:test";
import { buildBook, parseToken, parseTokens } from "./buildBook";

describe("parseToken", () => {
  test("splits surface, lemma and trailing punctuation", () => {
    expect(parseToken("Había|haber")).toEqual({
      lead: "",
      surf: "Había",
      trail: "",
      lemma: "haber",
    });
  });

  test("keeps leading and trailing punctuation outside the tappable surface", () => {
    expect(parseToken("—¿Adónde|adónde")).toEqual({
      lead: "—¿",
      surf: "Adónde",
      trail: "",
      lemma: "adónde",
    });
    expect(parseToken("ella.|ella")).toMatchObject({ surf: "ella", trail: "." });
  });

  test("reads the group field for Spanish multi-token units", () => {
    expect(parseToken("se|irse|g")).toEqual({
      lead: "",
      surf: "se",
      trail: "",
      lemma: "irse",
      group: "g",
    });
  });

  test("omits group and morphemes when the fields are empty", () => {
    const token = parseToken("옛날에|옛날||");
    expect(token).toEqual({ lead: "", surf: "옛날에", trail: "", lemma: "옛날" });
    expect("group" in token).toBe(false);
    expect("morphemes" in token).toBe(false);
  });

  test("splits Korean analysis into morphemes and turns underscores into spaces", () => {
    expect(parseToken("숲에서|숲||숲=rừng+에서=ở_(nơi_diễn_ra)")).toEqual({
      lead: "",
      surf: "숲에서",
      trail: "",
      lemma: "숲",
      morphemes: [
        { form: "숲", gloss: "rừng" },
        { form: "에서", gloss: "ở (nơi diễn ra)" },
      ],
    });
  });

  test("derives the lemma from the lowercase surface when the lemma field is empty", () => {
    expect(parseToken("II.")).toEqual({ lead: "", surf: "II", trail: ".", lemma: "ii" });
  });

  test("keeps quote marks as lead and trail of Korean tokens", () => {
    expect(parseToken("“어디에|어디||어디=đâu+에=đến")).toMatchObject({
      lead: "“",
      surf: "어디에",
      trail: "",
      lemma: "어디",
    });
    expect(parseToken("가요?”|가다||가=đi+아요=(lịch_sự)")).toMatchObject({
      surf: "가요",
      trail: "?”",
    });
  });
});

describe("parseTokens", () => {
  test("splits on single spaces", () => {
    expect(parseTokens("El|el lobo|lobo").map((token) => token.surf)).toEqual(["El", "lobo"]);
  });
});

describe("buildBook", () => {
  const source = {
    id: "test-book",
    title: "Test",
    lang: "es" as const,
    chapters: [
      {
        title: "I. Uno",
        titleVi: "Chương I. Một",
        paragraphs: [
          [
            { text: "Hola|hola", vi: "xin chào" },
            { text: "Adiós|adiós", vi: "tạm biệt" },
          ],
          [{ text: "Sí|sí", vi: "vâng" }],
        ],
      },
      {
        title: "II. Dos",
        paragraphs: [[{ text: "No|no", vi: "không" }]],
      },
    ],
    notes: [["note a"], ["note b", "note c"], ["note d"], ["note e"]],
  };

  test("assigns global consecutive ids with the title first in each chapter", () => {
    const book = buildBook(source);
    const sentences = book.chapters.flatMap((chapter) => [
      chapter.title,
      ...chapter.paragraphs.flat(),
    ]);
    expect(sentences.map((sentence) => sentence.id)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(sentences.map((sentence) => sentence.kind)).toEqual([
      "title",
      "body",
      "body",
      "body",
      "title",
      "body",
    ]);
    expect(sentences.map((sentence) => sentence.chapter)).toEqual([0, 0, 0, 0, 1, 1]);
  });

  test("gives body sentences their notes in order and titles no notes", () => {
    const book = buildBook(source);
    const chapterOne = book.chapters[0];
    const chapterTwo = book.chapters[1];
    expect(chapterOne?.title.notes).toBeUndefined();
    expect(chapterOne?.title.vi).toBe("Chương I. Một");
    expect(chapterOne?.paragraphs[0]?.map((sentence) => sentence.notes)).toEqual([
      ["note a"],
      ["note b", "note c"],
    ]);
    expect(chapterOne?.paragraphs[1]?.[0]?.notes).toEqual(["note d"]);
    expect(chapterTwo?.paragraphs[0]?.[0]?.notes).toEqual(["note e"]);
  });

  test("omits the title vi when the chapter has no title translation", () => {
    const book = buildBook(source);
    expect(book.chapters[1]?.title.vi).toBeUndefined();
  });

  test("throws when a body sentence has no notes entry", () => {
    expect(() => buildBook({ ...source, notes: [["only one"]] })).toThrow();
  });

  test("throws when the notes array has extra entries", () => {
    expect(() =>
      buildBook({ ...source, notes: [["a"], ["b"], ["c"], ["d"], ["extra"]] }),
    ).toThrow();
  });
});
