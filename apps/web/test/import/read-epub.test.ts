import { describe, expect, test } from "bun:test";
import { strToU8, zipSync } from "fflate";
import { EpubFileError, readEpubFiles } from "../../src/import/read-epub";

describe("reading an EPUB archive", () => {
  test("text files are decoded as UTF-8 and binary files are left out", () => {
    const bytes = zipSync({
      "META-INF/container.xml": strToU8("<c>niña</c>"),
      "OEBPS/a.xhtml": strToU8("<p>¿Qué?</p>"),
      "OEBPS/cover.png": new Uint8Array([1, 2, 3]),
    });
    expect(readEpubFiles(bytes)).toEqual({
      "META-INF/container.xml": "<c>niña</c>",
      "OEBPS/a.xhtml": "<p>¿Qué?</p>",
    });
  });

  test("bytes that are not a zip archive are rejected", () => {
    expect(() => readEpubFiles(new Uint8Array([1, 2, 3, 4]))).toThrow(EpubFileError);
  });
});
