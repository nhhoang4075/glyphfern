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

export function extractBlocks(html: string): TextBlock[] {
  const cleaned = removeNonContent(html);
  const blocks: TextBlock[] = [];
  let kind: TextBlock["kind"] = "paragraph";
  let cursor = 0;
  const flush = (end: number) => {
    const text = stripInline(cleaned.slice(cursor, end));
    if (text.length > 0) {
      blocks.push({ kind, text });
    }
  };
  for (const match of cleaned.matchAll(BLOCK_PATTERN)) {
    const index = match.index ?? 0;
    flush(index);
    cursor = index + match[0].length;
    const closing = match[1] === "/";
    const tag = match[2] ?? "";
    kind = !closing && HEADING_PATTERN.test(tag) ? "heading" : "paragraph";
  }
  flush(cleaned.length);
  return blocks;
}
