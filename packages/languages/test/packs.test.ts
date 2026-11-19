import { describe, expect, test } from "bun:test";
import type { Sentence } from "@glyphfern/core";
import { esPack, koPack, packs } from "../src/index";

function allSentences(sentences: { chapters: { title: Sentence; paragraphs: Sentence[][] }[] }) {
  return sentences.chapters.flatMap((chapter) => [chapter.title, ...chapter.paragraphs.flat()]);
}

function bodySentences(pack: { book: Parameters<typeof allSentences>[0] }) {
  return allSentences(pack.book).filter((sentence) => sentence.kind === "body");
}

describe("packs", () => {
  test("exports one pack per language", () => {
    expect(packs.es).toBe(esPack);
    expect(packs.ko).toBe(koPack);
  });

  test("sets the Spanish pack fields from the spec table", () => {
    expect(esPack.lang).toBe("es");
    expect(esPack.ttsLocale).toBe("es-ES");
    expect(esPack.pronunciationKind).toBe("ipa");
    expect(esPack.wordBreak).toBe("normal");
    expect(esPack.hyphenate).toBe(true);
  });

  test("sets the Korean pack fields from the spec table", () => {
    expect(koPack.lang).toBe("ko");
    expect(koPack.ttsLocale).toBe("ko-KR");
    expect(koPack.pronunciationKind).toBe("romanization");
    expect(koPack.wordBreak).toBe("keep-all");
    expect(koPack.hyphenate).toBe(false);
  });
});

describe("Spanish book", () => {
  test("has three chapters with the prototype sentence counts", () => {
    expect(esPack.book.chapters.map((chapter) => chapter.paragraphs.flat().length)).toEqual([
      4, 6, 6,
    ]);
  });

  test("has 19 sentences: 3 titles and 16 body sentences", () => {
    const sentences = allSentences(esPack.book);
    expect(sentences).toHaveLength(19);
    expect(sentences.filter((sentence) => sentence.kind === "title")).toHaveLength(3);
    expect(bodySentences(esPack)).toHaveLength(16);
  });

  test("uses the prototype chapter title translation for chapter I only", () => {
    const titles = esPack.book.chapters.map((chapter) => chapter.title.vi);
    expect(titles).toEqual(["Chương I. Khu rừng", undefined, undefined]);
  });

  test("ids are unique and consecutive from 0", () => {
    const ids = allSentences(esPack.book).map((sentence) => sentence.id);
    expect(ids).toEqual(Array.from({ length: ids.length }, (_, index) => index));
  });

  test("every body sentence has notes and titles have none", () => {
    for (const sentence of allSentences(esPack.book)) {
      if (sentence.kind === "body") {
        expect(sentence.notes?.length ?? 0).toBeGreaterThan(0);
      } else {
        expect(sentence.notes).toBeUndefined();
      }
    }
  });

  test("the first body sentence has the prototype translation", () => {
    const first = bodySentences(esPack)[0];
    expect(first?.vi).toBe(
      "Ngày xưa có một cô bé sống với bà trong một ngôi nhà nhỏ bên rìa rừng.",
    );
  });

  test("every body lemma has a dictionary entry", () => {
    const missing = new Set<string>();
    for (const sentence of bodySentences(esPack)) {
      for (const token of sentence.tokens) {
        if (esPack.dict[token.lemma] === undefined) {
          missing.add(token.lemma);
        }
      }
    }
    expect([...missing]).toEqual([]);
  });

  test("the reflexive unit se fue shares the group g", () => {
    const sentence = bodySentences(esPack).find((candidate) =>
      candidate.tokens.some((token) => token.surf === "fue"),
    );
    const groupMembers = sentence?.tokens.filter((token) => token.group === "g").map((t) => t.surf);
    expect(groupMembers).toEqual(["se", "fue"]);
  });

  test("applies expandPos to dictionary parts of speech", () => {
    expect(esPack.dict.haber?.pos).toBe("động từ");
    expect(esPack.dict.decir?.pos).toBe("động từ bất quy tắc");
    expect(esPack.dict.uno?.pos).toBe("mạo từ");
    expect(esPack.dict.tres?.pos).toBe("số từ");
  });

  test("omits the note field when the prototype note is empty", () => {
    expect(esPack.dict.con).toEqual({ pos: "giới từ", pronunciation: "/kon/", meaning: "với" });
    expect(esPack.dict.borde?.note).toBe("al borde de = bên rìa.");
  });

  test("starter lists match the prototype", () => {
    expect(esPack.knownLemmas).toHaveLength(28);
    expect(esPack.knownLemmas.slice(0, 3)).toEqual(["uno", "el", "con"]);
    expect(esPack.learningLemmas).toEqual({
      leña: 3,
      borde: 2,
      roble: 2,
      enfermo: 1,
      recoger: 1,
      despacio: 1,
      conocer: 1,
    });
  });
});

describe("Korean book", () => {
  test("has two chapters with titles and 10 body sentences", () => {
    const sentences = allSentences(koPack.book);
    expect(sentences).toHaveLength(12);
    expect(koPack.book.chapters.map((chapter) => chapter.paragraphs.flat().length)).toEqual([5, 5]);
    expect(bodySentences(koPack)).toHaveLength(10);
  });

  test("uses the prototype chapter titles translation", () => {
    expect(koPack.book.chapters.map((chapter) => chapter.title.vi)).toEqual([
      "Chương I. Trong rừng",
      "Chương II. Nhà bà",
    ]);
  });

  test("ids are unique and consecutive from 0", () => {
    const ids = allSentences(koPack.book).map((sentence) => sentence.id);
    expect(ids).toEqual(Array.from({ length: 12 }, (_, index) => index));
  });

  test("the token 숲에서 has the two prototype morphemes", () => {
    const token = bodySentences(koPack)
      .flatMap((sentence) => sentence.tokens)
      .find((candidate) => candidate.surf === "숲에서");
    expect(token?.morphemes).toEqual([
      { form: "숲", gloss: "rừng" },
      { form: "에서", gloss: "ở (nơi diễn ra)" },
    ]);
  });

  test("every body lemma has a dictionary entry", () => {
    const missing = new Set<string>();
    for (const sentence of bodySentences(koPack)) {
      for (const token of sentence.tokens) {
        if (koPack.dict[token.lemma] === undefined) {
          missing.add(token.lemma);
        }
      }
    }
    expect([...missing]).toEqual([]);
  });

  test("starter lists match the prototype", () => {
    expect(koPack.knownLemmas).toEqual(["한", "가다", "있다", "집", "어디", "날"]);
    expect(koPack.learningLemmas).toEqual({
      늑대: 3,
      줍다: 2,
      지름길: 2,
      꺾다: 1,
      천천히: 1,
    });
  });
});
