import { describe, expect, test } from "bun:test";
import {
  buildBookFromChapters,
  buildEpubBook,
  defaultSelectedIds,
} from "../../src/import/build-epub-book";
import { parseNavDocument, parseNcx } from "../../src/import/epub-navigation";
import { extractAnchoredBlocks } from "../../src/import/html-blocks";
import { EpubImportError } from "../../src/import/import-error";
import { parseEpubChapters } from "../../src/import/parse-epub-chapters";

const CONTAINER = `<container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>`;
const SENTENCE = "El niño camina por el bosque y canta una canción muy bonita. ";
const PARSE = { lang: "es" as const, fallbackTitle: (n: number) => `Fallback ${n}` };
const BUILD = { id: "b", lang: "es" as const, locale: "es", firstSentenceId: 100 };

function prose(sentences: number): string {
  return SENTENCE.repeat(sentences);
}

function page(body: string, bodyAttributes = ""): string {
  return `<html><body${bodyAttributes}>${body}</body></html>`;
}

interface DocumentSpec {
  html: string;
  linear?: boolean;
}

function manifest(documents: readonly DocumentSpec[], extraItems: string, extraSpine: string) {
  const items = documents
    .map((_, i) => `<item id="d${i}" href="d${i}.xhtml" media-type="application/xhtml+xml"/>`)
    .join("");
  const refs = documents
    .map((d, i) => `<itemref idref="d${i}"${d.linear === false ? ' linear="no"' : ""}/>`)
    .join("");
  return `<package><metadata xmlns:dc="x"><dc:title>Libro</dc:title><dc:language>es</dc:language></metadata><manifest>${items}${extraItems}</manifest><spine${extraSpine}>${refs}</spine></package>`;
}

function withDocuments(opf: string, documents: readonly DocumentSpec[]): Record<string, string> {
  const files: Record<string, string> = {
    "META-INF/container.xml": CONTAINER,
    "OEBPS/content.opf": opf,
  };
  documents.forEach((d, i) => {
    files[`OEBPS/d${i}.xhtml`] = d.html;
  });
  return files;
}

function navBook(documents: readonly DocumentSpec[], navMarkup: string): Record<string, string> {
  const opf = manifest(
    documents,
    `<item id="nav" href="nav.xhtml" properties="nav" media-type="application/xhtml+xml"/>`,
    "",
  );
  const files = withDocuments(opf, documents);
  files["OEBPS/nav.xhtml"] =
    `<html><body><nav epub:type="toc"><ol>${navMarkup}</ol></nav></body></html>`;
  return files;
}

function ncxBook(documents: readonly DocumentSpec[], points: string): Record<string, string> {
  const opf = manifest(
    documents,
    `<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`,
    ` toc="ncx"`,
  );
  const files = withDocuments(opf, documents);
  files["OEBPS/toc.ncx"] = `<ncx><navMap>${points}</navMap></ncx>`;
  return files;
}

function ncxPoint(label: string, src: string, children = ""): string {
  return `<navPoint id="${src}"><navLabel><text>${label}</text></navLabel><content src="${src}"/>${children}</navPoint>`;
}

function link(href: string, label: string, attributes = ""): string {
  return `<li><a href="${href}"${attributes}>${label}</a></li>`;
}

const THREE_CHAPTERS: DocumentSpec[] = [
  { html: page(`<h1>Uno</h1><p>${prose(14)}</p>`) },
  { html: page(`<h1>Dos</h1><p>${prose(14)}</p>`) },
  { html: page(`<h1>Tres</h1><p>${prose(14)}</p>`) },
];

function titles(files: Record<string, string>): string[] {
  return parseEpubChapters(files, PARSE).chapters.map((chapter) => chapter.title);
}

describe("navigation parsing", () => {
  test("a nav document yields labels, hrefs and epub types of the toc only", () => {
    const html = `<nav epub:type="landmarks"><ol><li><a href="x.xhtml">Landmark</a></li></ol></nav>
      <nav epub:type="toc"><ol>
        <li epub:type="frontmatter"><a href="a.xhtml#top">  Intro  <span>uno</span> </a></li>
        <li><a href="b.xhtml" epub:type="appendix">B &amp; C</a><ol><li><a href="c.xhtml">C</a></li></ol></li>
      </ol></nav>`;
    expect(parseNavDocument(html)).toEqual([
      { label: "Intro uno", href: "a.xhtml#top", types: ["frontmatter"] },
      { label: "B & C", href: "b.xhtml", types: ["appendix"] },
      { label: "C", href: "c.xhtml", types: [] },
    ]);
  });

  test("a document without a toc nav has no entries", () => {
    expect(parseNavDocument(`<nav epub:type="landmarks"><a href="a.xhtml">A</a></nav>`)).toEqual(
      [],
    );
  });

  test("an ncx yields nested nav points in document order", () => {
    const xml = `<navMap>${ncxPoint("Parte", "p.xhtml", ncxPoint("Uno", "u.xhtml#a"))}${ncxPoint("Dos", "d.xhtml")}</navMap>`;
    expect(parseNcx(xml).map((entry) => [entry.label, entry.href])).toEqual([
      ["Parte", "p.xhtml"],
      ["Uno", "u.xhtml#a"],
      ["Dos", "d.xhtml"],
    ]);
  });

  test("anchors map ids to the block that follows or contains them", () => {
    const { blocks, anchors } = extractAnchoredBlocks(
      `<p id="a">Uno</p><a id="m"/><h2 id="b">Dos</h2><p>T<span id="c">res</span></p>`,
    );
    expect(blocks).toHaveLength(3);
    expect([anchors.get("a"), anchors.get("m"), anchors.get("b"), anchors.get("c")]).toEqual([
      0, 1, 1, 2,
    ]);
  });
});

describe("chapters from the navigation", () => {
  test("a nav document gives one chapter per entry with trimmed labels", () => {
    const files = navBook(
      THREE_CHAPTERS,
      link("d0.xhtml", "  Primero ") + link("d1.xhtml", "Segundo") + link("d2.xhtml", "Tercero"),
    );
    const preview = parseEpubChapters(files, PARSE);
    expect(preview.source).toBe("navigation");
    expect(preview.chapters.map((chapter) => chapter.title)).toEqual([
      "Primero",
      "Segundo",
      "Tercero",
    ]);
    expect(preview.chapters.map((chapter) => chapter.id)).toEqual([
      "chapter-1",
      "chapter-2",
      "chapter-3",
    ]);
  });

  test("an ncx is used when there is no nav document", () => {
    const files = ncxBook(
      THREE_CHAPTERS,
      ncxPoint("Uno", "d0.xhtml") + ncxPoint("Dos", "d1.xhtml") + ncxPoint("Tres", "d2.xhtml"),
    );
    expect(titles(files)).toEqual(["Uno", "Dos", "Tres"]);
  });

  test("fragment targets split one document into chapters", () => {
    const html = page(
      `<h2 id="a">Alfa</h2><p>${prose(14)}</p><h2 id="b">Beta</h2><p>${prose(15)}</p><h2 id="c">Gamma</h2><p>${prose(16)}</p>`,
    );
    const files = navBook(
      [{ html }],
      link("d0.xhtml#a", "Alfa") + link("d0.xhtml#b", "Beta") + link("d0.xhtml#c", "Gamma"),
    );
    const { chapters } = parseEpubChapters(files, PARSE);
    expect(chapters.map((chapter) => chapter.title)).toEqual(["Alfa", "Beta", "Gamma"]);
    expect(chapters.map((chapter) => chapter.wordCount)).toEqual([14 * 12, 15 * 12, 16 * 12]);
    expect(chapters.every((chapter) => !chapter.frontBackMatter)).toBe(true);
  });

  test("a chapter runs across following documents that are not targets", () => {
    const documents: DocumentSpec[] = [
      { html: page(`<p>${prose(14)}</p>`) },
      { html: page(`<p>${prose(14)}</p>`) },
      { html: page(`<p>${prose(14)}</p>`) },
    ];
    const files = navBook(documents, link("d0.xhtml", "Uno") + link("d2.xhtml", "Dos"));
    expect(parseEpubChapters(files, PARSE).chapters.map((chapter) => chapter.wordCount)).toEqual([
      28 * 12,
      14 * 12,
    ]);
  });

  test("text before the first entry is not part of any chapter", () => {
    const documents: DocumentSpec[] = [
      { html: page(`<p>${prose(14)}</p>`) },
      { html: page(`<p>${prose(14)}</p>`) },
      { html: page(`<p>${prose(14)}</p>`) },
    ];
    const files = navBook(documents, link("d1.xhtml", "Dos") + link("d2.xhtml", "Tres"));
    expect(titles(files)).toEqual(["Dos", "Tres"]);
  });

  test("an entry without a label uses the fallback title", () => {
    const files = navBook(
      THREE_CHAPTERS,
      link("d0.xhtml", " ") + link("d1.xhtml", "Dos") + link("d2.xhtml", "Tres"),
    );
    expect(titles(files)[0]).toBe("Fallback 1");
  });

  test("a heading that repeats the label is not repeated in the body", () => {
    const files = navBook(
      THREE_CHAPTERS,
      link("d0.xhtml", "UNO") + link("d1.xhtml", "Dos") + link("d2.xhtml", "Tres"),
    );
    const first = parseEpubChapters(files, PARSE).chapters[0];
    expect(first?.blocks[0]?.kind).toBe("paragraph");
  });

  test("Gutenberg boilerplate and English blocks are removed from chapter text", () => {
    const documents: DocumentSpec[] = [
      {
        html: page(
          `<p>Copyright notice of the book and all rights reserved by the publisher.</p><p>*** START OF THE PROJECT GUTENBERG EBOOK LIBRO ***</p><p>${prose(14)}</p><p>This is a long English paragraph that the reader must not treat as Spanish text at all.</p>`,
        ),
      },
      {
        html: page(
          `<p>${prose(14)}</p><p>*** END OF THE PROJECT GUTENBERG EBOOK LIBRO ***</p><p>License text.</p>`,
        ),
      },
    ];
    const files = navBook(documents, link("d0.xhtml", "Uno") + link("d1.xhtml", "Dos"));
    const { chapters } = parseEpubChapters(files, PARSE);
    const text = chapters.flatMap((chapter) => chapter.blocks.map((block) => block.text)).join(" ");
    expect(chapters.map((chapter) => chapter.wordCount)).toEqual([14 * 12, 14 * 12]);
    expect(text).not.toContain("English");
    expect(text).not.toContain("License");
    expect(text).not.toContain("Copyright");
  });
});

describe("front and back matter candidates", () => {
  const SHORT = page("<p>Texto corto del libro.</p>");
  const documents: DocumentSpec[] = [
    { html: SHORT },
    { html: page(`<p>${prose(14)}</p>`) },
    { html: page(`<p>${prose(14)}</p>`, ' epub:type="backmatter"') },
    { html: page(`<p>${prose(14)}</p>`) },
    { html: page(`<p>${prose(14)}</p>`), linear: false },
  ];

  function candidates(files: Record<string, string>): boolean[] {
    return parseEpubChapters(files, PARSE).chapters.map((chapter) => chapter.frontBackMatter);
  }

  test("a short target document, an epub type and a non-linear document are candidates", () => {
    const files = navBook(
      documents,
      link("d0.xhtml", "Cubierta") +
        link("d1.xhtml", "Uno") +
        link("d2.xhtml", "Notas") +
        link("d3.xhtml", "Dos", ' epub:type="glossary"') +
        link("d4.xhtml", "Extra"),
    );
    expect(candidates(files)).toEqual([true, false, true, true, true]);
  });

  test("the nav entry epub type marks the list item as a candidate", () => {
    const files = navBook(
      documents.slice(0, 4),
      `${link("d1.xhtml", "Uno")}<li epub:type="copyright-page"><a href="d3.xhtml">Derechos</a></li>${link("d0.xhtml", "Fin")}`,
    );
    expect(candidates(files)).toEqual([true, false, true]);
  });

  test("a document of 150 tokens is not a candidate and one of 149 is", () => {
    const exact = (count: number) => page(`<p>${"casa ".repeat(count)}</p>`);
    const files = navBook(
      [{ html: exact(150) }, { html: exact(149) }, { html: exact(150) }],
      link("d0.xhtml", "A") + link("d1.xhtml", "B") + link("d2.xhtml", "C"),
    );
    expect(candidates(files)).toEqual([false, true, false]);
  });

  test("English text does not count as tokens of the target document", () => {
    const english = page(
      `<p>${prose(5)}</p><p>${"This is the text of the book and we are in it. ".repeat(20)}</p>`,
    );
    const files = navBook(
      [{ html: english }, { html: page(`<p>${prose(14)}</p>`) }],
      link("d0.xhtml", "A") + link("d1.xhtml", "B"),
    );
    expect(candidates(files)).toEqual([true, false]);
  });

  test("the element that carries the fragment decides the epub type", () => {
    const html = page(
      `<section id="a"><p>${prose(14)}</p></section><section id="b" epub:type="appendix"><p>${prose(14)}</p></section>`,
    );
    const files = navBook(
      [{ html }, { html: page(`<p>${prose(14)}</p>`) }],
      link("d0.xhtml#a", "Uno") + link("d0.xhtml#b", "Anexo") + link("d1.xhtml", "Dos"),
    );
    expect(candidates(files)).toEqual([false, true, false]);
  });

  test("candidate names carry no meaning, only structure does", () => {
    const files = navBook(
      THREE_CHAPTERS,
      link("d0.xhtml", "Anexo") + link("d1.xhtml", "Vocabulario") + link("d2.xhtml", "Resumen"),
    );
    expect(candidates(files)).toEqual([false, false, false]);
  });
});

describe("fallback to headings", () => {
  const HEADED: DocumentSpec[] = [
    { html: page(`<p>Capítulo 1 – Uno</p><p>${prose(14)}</p>`) },
    { html: page(`<p>Capítulo 2 – Dos</p><p>${prose(14)}</p>`) },
  ];

  test("without navigation the heading pipeline is used and no row is a candidate", () => {
    const files = withDocuments(manifest(HEADED, "", ""), HEADED);
    const preview = parseEpubChapters(files, PARSE);
    expect(preview.source).toBe("headings");
    expect(preview.chapters.map((chapter) => chapter.title)).toEqual(["1 · Uno", "2 · Dos"]);
    expect(preview.chapters.some((chapter) => chapter.frontBackMatter)).toBe(false);
  });

  test("a navigation with one entry falls back", () => {
    const files = navBook(HEADED, link("d0.xhtml", "Solo"));
    expect(parseEpubChapters(files, PARSE).source).toBe("headings");
  });

  test("entries that do not resolve to spine documents do not count", () => {
    const files = navBook(
      HEADED,
      link("d0.xhtml", "Uno") +
        link("https://example.com/x", "Web") +
        link("missing.xhtml", "Nada"),
    );
    expect(parseEpubChapters(files, PARSE).source).toBe("headings");
  });

  test("a nav document without a toc falls back to the ncx", () => {
    const files = ncxBook(
      THREE_CHAPTERS,
      ncxPoint("Uno", "d0.xhtml") + ncxPoint("Dos", "d1.xhtml") + ncxPoint("Tres", "d2.xhtml"),
    );
    expect(parseEpubChapters(files, PARSE).source).toBe("navigation");
  });

  test("a book with nothing readable is reported as empty", () => {
    const blank: DocumentSpec[] = [{ html: page("") }, { html: page("") }];
    const files = navBook(blank, link("d0.xhtml", "A") + link("d1.xhtml", "B"));
    expect(() => parseEpubChapters(files, PARSE)).toThrow(EpubImportError);
  });
});

describe("selection and building", () => {
  const documents: DocumentSpec[] = [
    { html: page("<p>Portada corta.</p>") },
    { html: page(`<p>${prose(14)}</p>`) },
    { html: page(`<p>${prose(15)}</p>`) },
  ];
  const files = navBook(
    documents,
    link("d0.xhtml", "Portada") + link("d1.xhtml", "Uno") + link("d2.xhtml", "Dos"),
  );
  const preview = parseEpubChapters(files, PARSE);

  test("candidate rows start unchecked and the others checked", () => {
    expect(defaultSelectedIds(preview)).toEqual(["chapter-2", "chapter-3"]);
  });

  test("the book holds exactly the selected chapters in book order", () => {
    const { book } = buildBookFromChapters(preview, ["chapter-3", "chapter-1"], BUILD);
    const titleOf = (chapter: (typeof book.chapters)[number]) =>
      chapter.title.tokens.map((token) => token.surf).join(" ");
    expect(book.chapters.map(titleOf)).toEqual(["Portada", "Dos"]);
    expect(book.chapters.map((chapter) => chapter.title.chapter)).toEqual([0, 1]);
    expect(book.title).toBe("Libro");
  });

  test("sentence ids are consecutive over the selected chapters only", () => {
    const { book, sentenceCount } = buildBookFromChapters(preview, ["chapter-2"], BUILD);
    const ids = book.chapters.flatMap((chapter) => [
      chapter.title.id,
      ...chapter.paragraphs.flat().map((sentence) => sentence.id),
    ]);
    expect(ids).toEqual(ids.map((_, index) => 100 + index));
    expect(sentenceCount).toBe(ids.length);
    expect(book.chapters).toHaveLength(1);
  });

  test("selecting nothing is an empty import and unknown ids are ignored", () => {
    expect(() => buildBookFromChapters(preview, [], BUILD)).toThrow(EpubImportError);
    expect(() => buildBookFromChapters(preview, ["nope"], BUILD)).toThrow(EpubImportError);
  });

  test("buildEpubBook imports the default selection", () => {
    const { book } = buildEpubBook(files, { ...BUILD, fallbackTitle: PARSE.fallbackTitle });
    expect(book.chapters).toHaveLength(2);
  });

  test("buildEpubBook keeps everything when every row is a candidate", () => {
    const tiny = navBook(
      [{ html: page("<p>Uno corto.</p>") }, { html: page("<p>Dos corto.</p>") }],
      link("d0.xhtml", "A") + link("d1.xhtml", "B"),
    );
    const { book } = buildEpubBook(tiny, { ...BUILD, fallbackTitle: PARSE.fallbackTitle });
    expect(book.chapters).toHaveLength(2);
  });
});
