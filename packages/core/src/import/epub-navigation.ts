import { attributesOf } from "./epub-package";
import { decodeEntities } from "./html-blocks";

export interface NavigationEntry {
  label: string;
  href: string;
  types: readonly string[];
}

const ANCHOR_PATTERN = /<a\b[^>]*>[\s\S]*?<\/a>/gi;
const LIST_ITEM_PATTERN = /<li\b[^>]*>/gi;
const NAV_PATTERN = /<nav\b([^>]*)>([\s\S]*?)<\/nav>/gi;
const NCX_POINT_PATTERN =
  /<navPoint\b[^>]*>\s*<navLabel\b[^>]*>\s*<text\b[^>]*>([\s\S]*?)<\/text>[\s\S]*?<content\b[^>]*\bsrc\s*=\s*"([^"]*)"/gi;

function plainLabel(markup: string): string {
  return decodeEntities(markup.replace(/<[^>]*>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

export function typeTokens(value: string | undefined): string[] {
  return (value ?? "").split(/\s+/).filter(Boolean);
}

function tocNavigation(html: string): string | undefined {
  for (const match of html.matchAll(NAV_PATTERN)) {
    if (typeTokens(attributesOf(`<nav ${match[1] ?? ""}>`)["epub:type"]).includes("toc")) {
      return match[2] ?? "";
    }
  }
  return undefined;
}

export function parseNavDocument(html: string): NavigationEntry[] {
  const navigation = tocNavigation(html);
  if (navigation === undefined) {
    return [];
  }
  const itemStarts = [...navigation.matchAll(LIST_ITEM_PATTERN)];
  const entries: NavigationEntry[] = [];
  for (const anchor of navigation.matchAll(ANCHOR_PATTERN)) {
    const attributes = attributesOf(anchor[0].slice(0, anchor[0].indexOf(">") + 1));
    if (!attributes.href) {
      continue;
    }
    const position = anchor.index ?? 0;
    const item = itemStarts.filter((start) => (start.index ?? 0) < position).pop();
    const itemTypes = item ? typeTokens(attributesOf(item[0])["epub:type"]) : [];
    entries.push({
      label: plainLabel(anchor[0]),
      href: decodeEntities(attributes.href),
      types: [...itemTypes, ...typeTokens(attributes["epub:type"])],
    });
  }
  return entries;
}

export function parseNcx(xml: string): NavigationEntry[] {
  return [...xml.matchAll(NCX_POINT_PATTERN)].map((match) => ({
    label: plainLabel(match[1] ?? ""),
    href: decodeEntities(match[2] ?? ""),
    types: [],
  }));
}
