import { describe, expect, test } from "bun:test";
import { EMPTY_BOOK } from "@glyphfern/core";
import { esPack, packs } from "../src/index";

describe("packs", () => {
  test("registers only the Spanish pack", () => {
    expect(Object.keys(packs)).toEqual(["es"]);
    expect(packs.es).toBe(esPack);
  });

  test("describes the Spanish pack", () => {
    expect(esPack.lang).toBe("es");
    expect(esPack.ttsLocale).toBe("es-ES");
    expect(esPack.pronunciationKind).toBe("ipa");
    expect(esPack.wordBreak).toBe("normal");
    expect(esPack.hyphenate).toBe(true);
  });

  test("ships no book", () => {
    expect(esPack.book).toBe(EMPTY_BOOK);
    expect(esPack.book.chapters).toEqual([]);
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
});
