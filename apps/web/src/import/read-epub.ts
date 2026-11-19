import { unzipSync } from "fflate";

const TEXT_FILE = /\.(xml|opf|xhtml|html|htm|ncx)$/i;
const MAX_EPUB_BYTES = 80 * 1024 * 1024;

export class EpubFileError extends Error {}

export function readEpubFiles(bytes: Uint8Array): Record<string, string> {
  if (bytes.byteLength > MAX_EPUB_BYTES) {
    throw new EpubFileError("EPUB file is too large");
  }
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes, { filter: (file) => TEXT_FILE.test(file.name) });
  } catch {
    throw new EpubFileError("File is not a valid EPUB archive");
  }
  const decoder = new TextDecoder("utf-8");
  const files: Record<string, string> = {};
  for (const [name, content] of Object.entries(entries)) {
    files[name] = decoder.decode(content);
  }
  return files;
}

export async function readEpubFile(file: File): Promise<Record<string, string>> {
  return readEpubFiles(new Uint8Array(await file.arrayBuffer()));
}
