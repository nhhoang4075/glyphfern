import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { buildEpubBook } from "../../src/import/build-epub-book";
import {
  dropEnglishBlocks,
  isEnglishBlock,
  isPublishingLine,
} from "../../src/import/drop-english-blocks";
import type { TextBlock } from "../../src/import/html-blocks";

const CONTAINER = `<container><rootfiles><rootfile full-path="content.opf"/></rootfiles></container>`;
const OPF = `<package><metadata xmlns:dc="x"><dc:title>Cuentos</dc:title></metadata><manifest><item id="a" href="a.xhtml" media-type="application/xhtml+xml"/><item id="b" href="b.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="a"/><itemref idref="b"/></spine></package>`;
const STORY =
  "El detective salió de la casa y caminó por el bosque hasta que llegó al castillo, donde nadie le esperaba. ";
const COPYRIGHT =
  "<p>Copyright © 2016 Olly Richards Publishing</p><p>All rights reserved. No part of this publication may be reproduced or transmitted in any form.</p><p>Olly Richards Publishing</p><p>ISBN-1522741003</p>";
const SUMMARY =
  "<p>In this chapter the detective goes to the castle and meets the owner, who is not happy about it.</p>";

const OPTIONS = {
  id: "c",
  lang: "es" as const,
  locale: "es",
  firstSentenceId: 1,
  fallbackTitle: (n: number) => `Capítulo ${n}`,
};

function files(first: string, second: string): Record<string, string> {
  return {
    "META-INF/container.xml": CONTAINER,
    "content.opf": OPF,
    "a.xhtml": `<body>${first}</body>`,
    "b.xhtml": `<body>${second}</body>`,
  };
}

function textOf(sentence: { tokens: { lead: string; surf: string; trail: string }[] }): string {
  return sentence.tokens.map((t) => t.lead + t.surf + t.trail).join(" ");
}

function bodyText(book: ReturnType<typeof buildEpubBook>["book"]): string {
  return book.chapters
    .flatMap((c) => c.paragraphs.flat())
    .map(textOf)
    .join(" ");
}

function block(text: string): TextBlock {
  return { kind: "paragraph", text };
}

describe("drop english blocks", () => {
  test("an English copyright block before the story is dropped", () => {
    const { book } = buildEpubBook(
      files(`${COPYRIGHT}<p>${STORY.repeat(4)}</p>`, "<p></p>"),
      OPTIONS,
    );
    const all = bodyText(book);
    for (const english of ["Copyright", "rights", "Publishing", "ISBN"]) {
      expect(all).not.toContain(english);
    }
    expect(all).toContain("detective");
    expect(book.chapters).toHaveLength(1);
  });

  test("an English summary paragraph between stories is dropped", () => {
    const { book } = buildEpubBook(
      files(`<p>${STORY.repeat(4)}</p>${SUMMARY}`, `<p>${STORY.repeat(4)}</p>`),
      OPTIONS,
    );
    expect(bodyText(book)).not.toContain("In this chapter");
    expect(book.chapters).toHaveLength(2);
  });

  test("a Spanish paragraph with a few English words is kept", () => {
    expect(
      isEnglishBlock(
        "Ella escuchaba rock and roll en la radio mientras el coche iba por la calle.",
      ),
    ).toBe(false);
  });

  test("Spanish dialogue and short Spanish headings are kept", () => {
    expect(isEnglishBlock("—¿Dónde estás?")).toBe(false);
    expect(isEnglishBlock("–Buenos días, jefe. ¿Qué noticias hay?")).toBe(false);
    expect(isEnglishBlock("Capítulo 1 – El detective")).toBe(false);
    expect(isEnglishBlock("La Costa")).toBe(false);
  });

  test("a glossary entry is judged by its Spanish side", () => {
    expect(isEnglishBlock("por eso = for that reason, that's why")).toBe(false);
  });

  test("a book without English is unchanged", () => {
    const documents = [
      [block("Hola mundo."), block(STORY.repeat(2))],
      [block("—¿Dónde estás?"), block(STORY)],
    ];
    expect(dropEnglishBlocks(documents)).toEqual(documents);
  });

  test("publishing lines inside the story are kept, outside it they are dropped", () => {
    const story = block(STORY.repeat(2));
    const middle = block("Editorial Planeta Publishing");
    const documents = [[block("Olly Richards Publishing"), story, middle, story, block("ISBN-1")]];
    expect(dropEnglishBlocks(documents)).toEqual([[story, middle, story]]);
  });

  test("short English leftovers before the story are dropped", () => {
    const story = block(STORY.repeat(2));
    expect(dropEnglishBlocks([[block("Table of Contents"), block("Preface")], [story]])).toEqual([
      [block("Preface")],
      [story],
    ]);
  });

  test("publishing line detection", () => {
    expect(isPublishingLine("Copyright © 2016 Someone")).toBe(true);
    expect(isPublishingLine("All rights reserved.")).toBe(true);
    expect(isPublishingLine("ISBN-978-1522741008")).toBe(true);
    expect(isPublishingLine("Olly Richards Publishing")).toBe(true);
    expect(isPublishingLine("El castillo estaba oscuro.")).toBe(false);
  });

  test("a document left with only a heading does not become a chapter", () => {
    const { book } = buildEpubBook(
      files(
        `<h1>Summary</h1>${SUMMARY}<p>Please read this note before you continue with the book.</p>`,
        `<h1>Uno</h1><p>${STORY.repeat(4)}</p>`,
      ),
      OPTIONS,
    );
    expect(book.chapters).toHaveLength(1);
    expect(textOf(book.chapters[0]?.title ?? ({ tokens: [] } as never))).toBe("Uno");
  });

  test("a language other than Spanish leaves the blocks untouched", () => {
    const { book } = buildEpubBook(files(`${COPYRIGHT}<p>${STORY.repeat(4)}</p>`, "<p></p>"), {
      ...OPTIONS,
      lang: "xx" as never,
    });
    expect(bodyText(book)).toContain("Copyright");
  });
});

function loadDirectory(root: string): Record<string, string> {
  const loaded: Record<string, string> = {};
  const walk = (directory: string) => {
    for (const name of readdirSync(directory)) {
      const path = join(directory, name);
      if (statSync(path).isDirectory()) {
        walk(path);
      } else if (/\.(x?html|xml|opf|ncx)$/.test(name)) {
        loaded[path.slice(root.length + 1)] = readFileSync(path, "utf8");
      }
    }
  };
  walk(root);
  return loaded;
}

const OLLY_DIRECTORY = process.env.SHORT_STORIES_DIR;
const MARIANELA_DIRECTORY = process.env.MARIANELA_DIR;
const ENGLISH_MARKERS = ["Copyright", "All rights reserved", "Olly Richards", "ISBN", "podcast"];

describe("real epubs", () => {
  test.skipIf(!OLLY_DIRECTORY || !existsSync(OLLY_DIRECTORY))(
    "the Olly Richards book starts with the story and has no English front matter",
    () => {
      const { book } = buildEpubBook(loadDirectory(OLLY_DIRECTORY ?? ""), OPTIONS);
      const first = book.chapters[0]?.paragraphs.flat().map(textOf) ?? [];
      expect(first.slice(0, 2)).toEqual(["1.", "El Castillo"]);
      const all = bodyText(book);
      for (const english of ENGLISH_MARKERS) {
        expect(all).not.toContain(english);
      }
      expect(book.chapters).toHaveLength(72);
    },
  );

  test.skipIf(!MARIANELA_DIRECTORY || !existsSync(MARIANELA_DIRECTORY))(
    "Marianela loses no sentence",
    () => {
      const files = loadDirectory(MARIANELA_DIRECTORY ?? "");
      const spanish = buildEpubBook(files, OPTIONS);
      const untouched = buildEpubBook(files, { ...OPTIONS, lang: "xx" as never });
      expect(spanish.sentenceCount).toBe(untouched.sentenceCount);
    },
  );
});
