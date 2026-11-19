import { describe, expect, test } from "bun:test";
import { buildEpubBook } from "../../src/import/build-epub-book";
import type { TextBlock } from "../../src/import/html-blocks";
import { splitByChapterHeadings } from "../../src/import/paragraph-chapters";

const CONTAINER = `<container><rootfiles><rootfile full-path="content.opf"/></rootfiles></container>`;
const STORY_TEXT =
  "El detective salió de la casa y caminó por el bosque hasta que llegó al castillo, donde nadie le esperaba. ";
const OPTIONS = {
  id: "l",
  lang: "es" as const,
  locale: "es",
  firstSentenceId: 1,
  fallbackTitle: (n: number) => `Fallback ${n}`,
};

function paragraphs(...texts: string[]): string {
  return texts.map((text) => `<p>${text}</p>`).join("");
}

function epub(documents: readonly string[]): Record<string, string> {
  const items = documents
    .map((_, i) => `<item id="d${i}" href="d${i}.xhtml" media-type="application/xhtml+xml"/>`)
    .join("");
  const refs = documents.map((_, i) => `<itemref idref="d${i}"/>`).join("");
  const opf = `<package><metadata xmlns:dc="x"><dc:title>Cuentos</dc:title></metadata><manifest>${items}</manifest><spine>${refs}</spine></package>`;
  const result: Record<string, string> = {
    "META-INF/container.xml": CONTAINER,
    "content.opf": opf,
  };
  documents.forEach((html, i) => {
    result[`d${i}.xhtml`] = `<body>${html}</body>`;
  });
  return result;
}

function textOf(sentence: { tokens: { lead: string; surf: string; trail: string }[] }): string {
  return sentence.tokens.map((t) => t.lead + t.surf + t.trail).join(" ");
}

function titles(book: ReturnType<typeof buildEpubBook>["book"]): string[] {
  return book.chapters.map((c) => textOf(c.title));
}

describe("heading fallback", () => {
  test("chapter headings without appendices split at the headings", () => {
    const { book } = buildEpubBook(
      epub([
        paragraphs("Capítulo 1: Inicio", STORY_TEXT, "Capítulo 2. Nudo", STORY_TEXT),
        paragraphs(STORY_TEXT, "CAPÍTULO 3 — Final", STORY_TEXT),
      ]),
      OPTIONS,
    );
    expect(titles(book)).toEqual(["1· Inicio", "2· Nudo", "3· Final"]);
  });

  test("a single chapter heading leaves the book as one chapter per document", () => {
    const { book } = buildEpubBook(
      epub([
        paragraphs("Capítulo 1 – Inicio", STORY_TEXT.repeat(2)),
        paragraphs("Resumen", STORY_TEXT.repeat(2)),
      ]),
      OPTIONS,
    );
    expect(titles(book)).toEqual(["Fallback 1", "Fallback 2"]);
  });

  test("Roman numeral chapters in capital words are not touched", () => {
    const { book } = buildEpubBook(
      epub([
        paragraphs("CAPÍTULO I", STORY_TEXT.repeat(2)),
        paragraphs("CAPÍTULO II", STORY_TEXT.repeat(2)),
      ]),
      OPTIONS,
    );
    expect(titles(book)).toEqual(["Fallback 1", "Fallback 2"]);
  });

  test("a numbered list in a book without chapter headings is not a story heading", () => {
    const blocks: TextBlock[] = [
      { kind: "paragraph", text: "1. Primero" },
      { kind: "paragraph", text: "texto" },
    ];
    expect(splitByChapterHeadings(blocks)).toBeUndefined();
  });
});
