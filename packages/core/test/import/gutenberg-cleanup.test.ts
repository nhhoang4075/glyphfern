import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { buildEpubBook } from "../../src/import/build-epub-book";
import { cutGutenbergBoilerplate, dropContentsRuns } from "../../src/import/clean-gutenberg";
import { extractBlocks } from "../../src/import/html-blocks";

const CONTAINER = `<container><rootfiles><rootfile full-path="content.opf"/></rootfiles></container>`;
const OPF = `<package><metadata xmlns:dc="x"><dc:title>Marianela</dc:title></metadata><manifest><item id="a" href="a.xhtml" media-type="application/xhtml+xml"/><item id="b" href="b.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="a"/><itemref idref="b"/></spine></package>`;
const BODY = "Se puso el sol y llegó la noche tranquila. ".repeat(10);

const BOILERPLATE = [
  "<h2>The Project Gutenberg eBook of <span>Marianela</span></h2>",
  "<div>This eBook is for the use of anyone anywhere in the United States.</div>",
  "<p><strong>Title</strong>: Marianela</p><p><strong>Author</strong>: Benito Pérez Galdós</p>",
  "<p><strong>Release date</strong>: December 17, 2005 [eBook #17340]<br/>Most recently updated: October 10, 2025</p>",
  "<p><strong>Language</strong>: Spanish</p><p><strong>Credits</strong>: Chuck Greif</p>",
  "<div><span>*** START OF THE PROJECT GUTENBERG EBOOK MARIANELA ***</span></div>",
].join("");
const CONTENTS = ["I", "II", "III"].map((n) => `<p>-${n}-,</p>`).join("");
const FOOTER =
  "<div>*** END OF THE PROJECT GUTENBERG EBOOK MARIANELA ***</div><div>Updated editions will replace the previous one.</div>";

function files(first: string, second: string): Record<string, string> {
  return {
    "META-INF/container.xml": CONTAINER,
    "content.opf": OPF,
    "a.xhtml": `<body>${first}</body>`,
    "b.xhtml": `<body>${second}</body>`,
  };
}

const OPTIONS = {
  id: "m",
  lang: "es" as const,
  locale: "es",
  firstSentenceId: 1,
  fallbackTitle: (n: number) => `Capítulo ${n}`,
};

function titleOf(sentence: { tokens: { lead: string; surf: string; trail: string }[] }): string {
  return sentence.tokens.map((t) => t.lead + t.surf + t.trail).join(" ");
}

describe("gutenberg cleanup", () => {
  test("boilerplate, contents and footer are removed and chapters split at numeral headings", () => {
    const book = buildEpubBook(
      files(
        `${BOILERPLATE}<h1>Marianela</h1><p>Por Galdós</p>${CONTENTS}<h2>-I-<br/>Perdido</h2><p>${BODY}</p>`,
        `<h2>-II-</h2><p>${BODY}</p>${FOOTER}`,
      ),
      OPTIONS,
    ).book;
    expect(book.title).toBe("Marianela");
    expect(book.chapters).toHaveLength(2);
    expect(titleOf(book.chapters[0]?.title ?? ({ tokens: [] } as never))).toBe("I· Perdido");
    expect(book.chapters[1]?.title.tokens.map((t) => t.surf)).toEqual(["II"]);
    expect(titleOf(book.chapters[0]?.paragraphs[0]?.[0] ?? ({ tokens: [] } as never))).toBe(
      "Se puso el sol y llegó la noche tranquila.",
    );
    const all = book.chapters
      .flatMap((c) => c.paragraphs.flat())
      .map(titleOf)
      .join(" ");
    for (const english of [
      "Gutenberg",
      "This eBook",
      "Title",
      "Author",
      "Release date",
      "Most recently updated",
      "Language: Spanish",
      "Credits",
      "Chuck",
    ]) {
      expect(all).not.toContain(english);
    }
    expect(all).not.toContain("Updated editions");
  });

  test("a heading split across files does not duplicate chapters", () => {
    const book = buildEpubBook(
      files(`<h2>-I-</h2><p>${BODY}</p>`, `<p>${BODY}</p><h2>-II-</h2><p>${BODY}</p>`),
      OPTIONS,
    ).book;
    expect(book.chapters).toHaveLength(2);
    expect(book.chapters[0]?.paragraphs).toHaveLength(2);
  });

  test("without markers nothing is cut", () => {
    const documents = [extractBlocks("<p>Hola mundo.</p><p>Adiós.</p>")];
    expect(cutGutenbergBoilerplate(documents)).toEqual(documents);
  });

  test("without numeral headings the spine documents stay chapters", () => {
    const book = buildEpubBook(
      files(`<h1>Uno</h1><p>${BODY}</p>`, `<h1>Dos</h1><p>${BODY}</p>`),
      OPTIONS,
    ).book;
    expect(book.chapters.map((c) => titleOf(c.title))).toEqual(["Uno", "Dos"]);
  });

  test("only runs of three or more numerals count as contents", () => {
    const blocks = extractBlocks("<p>-I-,</p><p>-II-,</p><p>Texto.</p>");
    expect(dropContentsRuns(blocks)).toEqual(blocks);
    expect(dropContentsRuns(extractBlocks(`${CONTENTS}<p>Texto.</p>`))).toEqual([
      { kind: "paragraph", text: "Texto." },
    ]);
  });
});

const REAL_DIRECTORY = process.env.MARIANELA_DIR;

describe("real Marianela epub", () => {
  test.skipIf(!REAL_DIRECTORY || !existsSync(REAL_DIRECTORY))(
    "yields 22 chapters starting with the story",
    () => {
      const root = REAL_DIRECTORY ?? "";
      const loaded: Record<string, string> = {};
      const walk = (directory: string) => {
        for (const name of readdirSync(directory)) {
          const path = join(directory, name);
          if (statSync(path).isDirectory()) {
            walk(path);
          } else if (/\.(html|xml|opf|ncx)$/.test(name)) {
            loaded[path.slice(root.length + 1)] = readFileSync(path, "utf8");
          }
        }
      };
      walk(root);
      const { book } = buildEpubBook(loaded, OPTIONS);
      expect(book.chapters).toHaveLength(22);
      expect(titleOf(book.chapters[0]?.paragraphs[0]?.[0] ?? ({ tokens: [] } as never))).toBe(
        "Se puso el sol.",
      );
    },
  );
});
