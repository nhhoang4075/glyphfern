export interface TextBlock {
  kind: "heading" | "paragraph";
  text: string;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  laquo: "«",
  raquo: "»",
  iexcl: "¡",
  iquest: "¿",
  aacute: "á",
  eacute: "é",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  Aacute: "Á",
  Eacute: "É",
  Iacute: "Í",
  Oacute: "Ó",
  Uacute: "Ú",
  ntilde: "ñ",
  Ntilde: "Ñ",
  uuml: "ü",
  Uuml: "Ü",
};

const ENTITY_PATTERN = /&(#x[0-9a-fA-F]+|#[0-9]+|[A-Za-z][A-Za-z0-9]*);/g;
const BLOCK_PATTERN = /<(\/?)(h[1-6]|p|div|li|blockquote|section|article|br|tr)\b[^>]*>/gi;
const HEADING_PATTERN = /^h[1-6]$/i;

export function decodeEntities(text: string): string {
  return text.replace(ENTITY_PATTERN, (match, body: string) => {
    if (body.startsWith("#x") || body.startsWith("#X")) {
      return String.fromCodePoint(Number.parseInt(body.slice(2), 16));
    }
    if (body.startsWith("#")) {
      return String.fromCodePoint(Number.parseInt(body.slice(1), 10));
    }
    return NAMED_ENTITIES[body] ?? match;
  });
}

function stripInline(markup: string): string {
  return decodeEntities(markup.replace(/<[^>]*>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

function removeNonContent(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|head|svg)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<\?[\s\S]*?\?>/g, "");
}

export interface AnchoredBlocks {
  blocks: TextBlock[];
  anchors: ReadonlyMap<string, number>;
}

const TAG_PATTERN = /<[A-Za-z][^>]*>/g;
const ANCHOR_ATTRIBUTE = /\b(?:id|name)\s*=\s*"([^"]+)"/gi;

export function extractAnchoredBlocks(html: string): AnchoredBlocks {
  const cleaned = removeNonContent(html);
  const blocks: TextBlock[] = [];
  const ends: number[] = [];
  let kind: TextBlock["kind"] = "paragraph";
  let cursor = 0;
  const flush = (end: number) => {
    const text = stripInline(cleaned.slice(cursor, end));
    if (text.length > 0) {
      blocks.push({ kind, text });
      ends.push(end);
    }
  };
  for (const match of cleaned.matchAll(BLOCK_PATTERN)) {
    const index = match.index ?? 0;
    const closing = match[1] === "/";
    const tag = match[2] ?? "";
    if (tag.toLowerCase() === "br" && kind === "heading") {
      continue;
    }
    flush(index);
    cursor = index + match[0].length;
    kind = !closing && HEADING_PATTERN.test(tag) ? "heading" : "paragraph";
  }
  flush(cleaned.length);
  const anchors = new Map<string, number>();
  for (const tag of cleaned.matchAll(TAG_PATTERN)) {
    const position = tag.index ?? 0;
    for (const attribute of tag[0].matchAll(ANCHOR_ATTRIBUTE)) {
      const id = attribute[1] ?? "";
      if (!anchors.has(id)) {
        const found = ends.findIndex((end) => end > position);
        anchors.set(id, found < 0 ? blocks.length : found);
      }
    }
  }
  return { blocks, anchors };
}

export function extractBlocks(html: string): TextBlock[] {
  return extractAnchoredBlocks(html).blocks;
}

const WORD_PATTERN = /[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu;

export function countWords(blocks: readonly TextBlock[]): number {
  return blocks.reduce((sum, block) => sum + (block.text.match(WORD_PATTERN)?.length ?? 0), 0);
}
