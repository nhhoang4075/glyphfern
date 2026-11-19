import { describe, expect, test } from "bun:test";
import { buildEpubBook } from "../../src/import/build-epub-book";
import { findRootfilePath, parseOpf, resolveHref } from "../../src/import/epub-package";
import { decodeEntities, extractBlocks } from "../../src/import/html-blocks";
import { EpubImportError } from "../../src/import/import-error";
import { splitSentences, tokenizeSentence } from "../../src/import/split-text";

const CONTAINER = `<?xml version="1.0"?><container><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`;

const OPF = `<package xmlns="http://www.idpf.org/2007/opf"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>El lobo</dc:title><dc:language>es</dc:language></metadata><manifest>
<item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>
<item id="c1" href="text/c1.xhtml" media-type="application/xhtml+xml"/>
<item id="c2" href="text/c2.xhtml" media-type="application/xhtml+xml"/>
<item id="img" href="a.png" media-type="image/png"/>
</manifest><spine><itemref idref="cover"/><itemref idref="c1"/><itemref idref="c2"/><itemref idref="img"/></spine></package>`;

const LONG = "Había una vez una niña que vivía cerca del bosque. ".repeat(8);

function chapter(title: string, body: string): string {
  return `<html><head><title>x</title></head><body><h1>${title}</h1><p>${body}</p><p>—¿Adónde vas? —preguntó el lobo.</p></body></html>`;
}

const FILES: Record<string, string> = {
  "META-INF/container.xml": CONTAINER,
  "OEBPS/content.opf": OPF,
  "OEBPS/cover.xhtml": "<html><body><p>Portada</p></body></html>",
  "OEBPS/text/c1.xhtml": chapter("Capítulo I", LONG),
  "OEBPS/text/c2.xhtml": chapter("Capítulo II", LONG),
};

const OPTIONS = {
  id: "user-1",
  lang: "es" as const,
  locale: "es",
  firstSentenceId: 1_000_000,
  fallbackTitle: (n: number) => `Capítulo ${n}`,
};

describe("html blocks", () => {
  test("headings and paragraphs are separated and inline tags dropped", () => {
    const blocks = extractBlocks("<body><h2>Uno</h2><p>Hola <em>mundo</em>.</p></body>");
    expect(blocks).toEqual([
      { kind: "heading", text: "Uno" },
      { kind: "paragraph", text: "Hola mundo." },
    ]);
  });

  test("entities decode and scripts are ignored", () => {
    expect(decodeEntities("ni&ntilde;a &#241; &#xF1; &amp; &unknown;")).toBe(
      "niña ñ ñ & &unknown;",
    );
    expect(extractBlocks("<p>a<script>x()</script>b</p>")).toEqual([
      { kind: "paragraph", text: "ab" },
    ]);
  });
});

describe("epub package", () => {
  test("the root file path comes from the container", () => {
    expect(findRootfilePath(CONTAINER)).toBe("OEBPS/content.opf");
  });

  test("the package yields title, language, items and spine", () => {
    const opf = parseOpf(OPF);
    expect(opf.title).toBe("El lobo");
    expect(opf.language).toBe("es");
    expect(opf.spine).toEqual(["cover", "c1", "c2", "img"]);
    expect(opf.items.get("c1")?.href).toBe("text/c1.xhtml");
  });

  test("hrefs resolve against the package folder", () => {
    expect(resolveHref("OEBPS/content.opf", "text/c1.xhtml#a")).toBe("OEBPS/text/c1.xhtml");
    expect(resolveHref("OEBPS/text/c1.xhtml", "../img/a%20b.png")).toBe("OEBPS/img/a b.png");
  });
});

describe("sentence and token splitting", () => {
  test("sentences split after terminal punctuation", () => {
    expect(splitSentences("Hola. ¿Qué tal? Bien.", "es")).toEqual(["Hola.", "¿Qué tal?", "Bien."]);
  });

  test("punctuation moves to lead and trail and the lemma is the lowercase surface", () => {
    expect(tokenizeSentence("—¿Adónde vas?")).toEqual([
      { lead: "—¿", surf: "Adónde", trail: "", lemma: "adónde" },
      { lead: "", surf: "vas", trail: "?", lemma: "vas" },
    ]);
  });

  test("a lone dash joins the previous token", () => {
    const tokens = tokenizeSentence("dijo — hola");
    expect(tokens[0]?.trail).toBe("—");
    expect(tokens).toHaveLength(2);
  });
});

describe("book building", () => {
  test("the cover is skipped and each remaining document becomes a chapter", () => {
    const { book } = buildEpubBook(FILES, OPTIONS);
    expect(book.title).toBe("El lobo");
    expect(book.chapters).toHaveLength(2);
    expect(book.chapters[0]?.title.tokens.map((t) => t.surf)).toEqual(["Capítulo", "I"]);
    expect(book.chapters[0]?.title.kind).toBe("title");
  });

  test("sentence ids are consecutive from the base and the title comes first", () => {
    const { book, sentenceCount } = buildEpubBook(FILES, OPTIONS);
    const ids = book.chapters.flatMap((c) => [c.title.id, ...c.paragraphs.flat().map((s) => s.id)]);
    expect(ids[0]).toBe(1_000_000);
    expect(ids).toEqual(ids.map((_, i) => 1_000_000 + i));
    expect(sentenceCount).toBe(ids.length);
  });

  test("a chapter without a heading uses the fallback title", () => {
    const files = { ...FILES, "OEBPS/text/c1.xhtml": `<body><p>${LONG}</p></body>` };
    const { book } = buildEpubBook(files, OPTIONS);
    expect(book.chapters[0]?.title.tokens.map((t) => t.surf)).toEqual(["Capítulo", "1"]);
  });

  test("a broken container and an empty book are reported", () => {
    expect(() => buildEpubBook({}, OPTIONS)).toThrow(EpubImportError);
    const empty = {
      ...FILES,
      "OEBPS/cover.xhtml": "",
      "OEBPS/text/c1.xhtml": "",
      "OEBPS/text/c2.xhtml": "",
    };
    expect(() => buildEpubBook(empty, OPTIONS)).toThrow(EpubImportError);
  });
});
