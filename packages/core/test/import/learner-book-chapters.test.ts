import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { buildEpubBook } from "../../src/import/build-epub-book";
import { dropAppendixDocuments } from "../../src/import/drop-appendix-documents";
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

function appendixDocuments(n: number, anexo = "Anexo del capítulo"): string[] {
  return [
    paragraphs(
      `${anexo} ${n}`,
      "Resumen",
      "El detective Morgan trabajaba en una ciudad muy tranquila.",
      "Vocabulario",
      "bosque = forest",
      "castillo = castle",
    ),
    paragraphs("Preguntas de elección múltiple", "1. La ciudad es:", "a. Ruidosa", "b. Pequeña"),
    paragraphs(`Soluciones capítulo ${n}`, "1. a", "2. d"),
  ];
}

describe("learner book layout", () => {
  const documents = [
    paragraphs("CUENTOS"),
    paragraphs("1. El Castillo", "Capítulo 1 – El detective", `${STORY_TEXT}Fin del primer día.`),
    ...appendixDocuments(1),
    paragraphs("Capítulo 2 – El segundo coche", STORY_TEXT),
    ...appendixDocuments(2),
    paragraphs("2. El Cocinero", "Capítulo 1 – Naranjas", STORY_TEXT, "FIN"),
    ...appendixDocuments(1),
    paragraphs("Thanks for Reading!"),
  ];

  test("chapters come only from story headings with readable titles", () => {
    const { book } = buildEpubBook(epub(documents), OPTIONS);
    expect(titles(book)).toEqual([
      "El Castillo· 1· El detective",
      "El Castillo· 2· El segundo coche",
      "El Cocinero· 1· Naranjas",
    ]);
  });

  test("appendix, glossary and quiz text is gone and the end marker is cut", () => {
    const { book } = buildEpubBook(epub(documents), OPTIONS);
    const all = book.chapters
      .flatMap((c) => c.paragraphs.flat())
      .map(textOf)
      .join(" ");
    for (const unwanted of ["Anexo", "forest", "Ruidosa", "Soluciones", "FIN", "Resumen"]) {
      expect(all).not.toContain(unwanted);
    }
    expect(all).toContain("castillo");
  });

  test("the story number alone on a line followed by the title line is recognised", () => {
    const { book } = buildEpubBook(
      epub([
        paragraphs("1.", "El Castillo", "Capítulo 1 – El detective", STORY_TEXT),
        paragraphs("Capítulo 2", STORY_TEXT),
      ]),
      OPTIONS,
    );
    expect(titles(book)).toEqual(["El Castillo· 1· El detective", "El Castillo· 2"]);
  });

  test("text before the first chapter heading is not a chapter", () => {
    const { book } = buildEpubBook(
      epub([
        paragraphs(STORY_TEXT.repeat(5)),
        paragraphs("Capítulo 1 – Uno", STORY_TEXT),
        paragraphs("Capítulo 2 – Dos", STORY_TEXT),
      ]),
      OPTIONS,
    );
    expect(titles(book)).toEqual(["1· Uno", "2· Dos"]);
  });

  test("a chapter heading without a body produces no empty chapter", () => {
    const { book } = buildEpubBook(
      epub([
        paragraphs("Capítulo 1 – Uno"),
        paragraphs("Capítulo 2 – Dos", STORY_TEXT),
        paragraphs("Capítulo 3 – Tres", STORY_TEXT),
      ]),
      OPTIONS,
    );
    expect(titles(book)).toEqual(["2· Dos", "3· Tres"]);
  });
});

describe("books without appendices or without chapter headings", () => {
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

  test("a single chapter heading leaves the book unchanged and keeps appendix-like documents", () => {
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

describe("appendix document detection", () => {
  const doc = (first: string): TextBlock[] => [
    { kind: "paragraph", text: first },
    { kind: "paragraph", text: "texto" },
  ];
  const withHeadings: TextBlock[][] = [
    [
      { kind: "paragraph", text: "Capítulo 1" },
      { kind: "paragraph", text: "cuerpo" },
    ],
    [
      { kind: "paragraph", text: "Capítulo 2" },
      { kind: "paragraph", text: "cuerpo" },
    ],
  ];

  test.each([
    "Anexo del capítulo 3",
    "ANEXO",
    "anexos en cada capítulo",
    "Vocabulario",
    "VOCABULARIO",
    "Résumen",
    "Resumen del capítulo",
    "Preguntas de elección múltiple",
    "Soluciones capítulo 2",
    "Respuestas",
  ])("%s starts an appendix document", (first) => {
    const kept = dropAppendixDocuments([...withHeadings, doc(first)]);
    expect(kept).toHaveLength(2);
  });

  test("ordinary documents stay and nothing is dropped without chapter headings", () => {
    expect(dropAppendixDocuments([...withHeadings, doc("El castillo")])).toHaveLength(3);
    expect(dropAppendixDocuments([doc("Vocabulario"), doc("Anexo")])).toHaveLength(2);
  });
});

function loadDirectory(root: string): Record<string, string> {
  const loaded: Record<string, string> = {};
  const walk = (directory: string, prefix: string) => {
    for (const name of readdirSync(directory)) {
      const path = join(directory, name);
      const relative = prefix ? `${prefix}/${name}` : name;
      if (statSync(path).isDirectory()) {
        walk(path, relative);
      } else if (/\.(xml|opf|xhtml|html)$/.test(name)) {
        loaded[relative] = readFileSync(path, "utf8");
      }
    }
  };
  walk(root, "");
  return loaded;
}

const OLLY_DIRECTORY = process.env.SHORT_STORIES_DIR;
const MARIANELA_DIRECTORY = process.env.MARIANELA_DIR;

describe("real epubs", () => {
  test.skipIf(!OLLY_DIRECTORY || !existsSync(OLLY_DIRECTORY))(
    "the Olly Richards book imports its 24 story chapters only",
    () => {
      const { book } = buildEpubBook(loadDirectory(OLLY_DIRECTORY ?? ""), OPTIONS);
      expect(book.chapters).toHaveLength(24);
      expect(titles(book)[0]).toBe("El Castillo· 1· El detective");
      expect(titles(book).at(-1)).toBe("La Costa· 3· El faro");
      const all = book.chapters
        .flatMap((c) => c.paragraphs.flat())
        .map(textOf)
        .join(" ");
      for (const unwanted of ["Anexo", "Vocabulario", "Soluciones", "Olly", "FIN"]) {
        expect(all).not.toContain(unwanted);
      }
    },
  );

  test.skipIf(!MARIANELA_DIRECTORY || !existsSync(MARIANELA_DIRECTORY))(
    "Marianela keeps 22 chapters and 3535 sentences",
    () => {
      const result = buildEpubBook(loadDirectory(MARIANELA_DIRECTORY ?? ""), OPTIONS);
      expect(result.book.chapters).toHaveLength(22);
      expect(result.sentenceCount).toBe(3535);
    },
  );
});
