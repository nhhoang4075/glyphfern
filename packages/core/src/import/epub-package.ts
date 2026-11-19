export interface OpfItem {
  id: string;
  href: string;
  mediaType: string;
  properties: readonly string[];
}

export interface SpineDocument {
  idref: string;
  linear: boolean;
}

export interface OpfPackage {
  title: string;
  language: string;
  items: ReadonlyMap<string, OpfItem>;
  spine: readonly string[];
  documents: readonly SpineDocument[];
}

const ATTRIBUTE_PATTERN = /([A-Za-z_:][\w:.-]*)\s*=\s*"([^"]*)"/g;

export function attributesOf(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const match of tag.matchAll(ATTRIBUTE_PATTERN)) {
    attributes[(match[1] ?? "").toLowerCase()] = match[2] ?? "";
  }
  return attributes;
}

function elementText(xml: string, name: string): string {
  const match = new RegExp(`<(?:\\w+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${name}>`, "i").exec(
    xml,
  );
  return (match?.[1] ?? "").replace(/<[^>]*>/g, "").trim();
}

export function findRootfilePath(containerXml: string): string | undefined {
  const tag = /<rootfile\b[^>]*>/i.exec(containerXml)?.[0];
  return tag ? attributesOf(tag)["full-path"] : undefined;
}

export function parseOpf(opfXml: string): OpfPackage {
  const items = new Map<string, OpfItem>();
  for (const match of opfXml.matchAll(/<item\b[^>]*>/gi)) {
    const attributes = attributesOf(match[0]);
    const id = attributes.id;
    const href = attributes.href;
    if (id && href) {
      items.set(id, {
        id,
        href,
        mediaType: attributes["media-type"] ?? "",
        properties: (attributes.properties ?? "").split(/\s+/).filter(Boolean),
      });
    }
  }
  const spine: string[] = [];
  const documents: SpineDocument[] = [];
  for (const match of opfXml.matchAll(/<itemref\b[^>]*>/gi)) {
    const attributes = attributesOf(match[0]);
    if (attributes.idref) {
      const linear = attributes.linear !== "no";
      documents.push({ idref: attributes.idref, linear });
      if (linear) {
        spine.push(attributes.idref);
      }
    }
  }
  return {
    title: elementText(opfXml, "title"),
    language: elementText(opfXml, "language"),
    items,
    spine,
    documents,
  };
}

export function splitHref(href: string): { path: string; fragment: string } {
  const hash = href.indexOf("#");
  return hash < 0
    ? { path: href, fragment: "" }
    : { path: href.slice(0, hash), fragment: decodeURIComponent(href.slice(hash + 1)) };
}

export function resolveHref(basePath: string, href: string): string {
  const withoutFragment = href.split("#")[0] ?? "";
  const decoded = decodeURIComponent(withoutFragment);
  const baseParts = basePath.split("/").slice(0, -1);
  const parts = decoded.startsWith("/") ? [] : baseParts;
  for (const segment of decoded.split("/")) {
    if (segment === "..") {
      parts.pop();
    } else if (segment !== "." && segment !== "") {
      parts.push(segment);
    }
  }
  return parts.join("/");
}
