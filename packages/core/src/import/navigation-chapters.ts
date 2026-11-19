import { type NavigationEntry, typeTokens } from "./epub-navigation";
import { attributesOf } from "./epub-package";
import type { TextBlock } from "./html-blocks";

export interface SourceDocument {
  path: string;
  linear: boolean;
  html: string;
  blocks: TextBlock[];
  anchors: ReadonlyMap<string, number>;
}

export interface ResolvedEntry {
  label: string;
  documentIndex: number;
  blockIndex: number;
  marked: boolean;
}

export interface EntryTarget {
  entry: NavigationEntry;
  path: string;
  fragment: string;
}

const FRONT_BACK_TYPES = new Set([
  "frontmatter",
  "backmatter",
  "toc",
  "copyright-page",
  "titlepage",
  "index",
  "glossary",
  "appendix",
  "bibliography",
  "acknowledgments",
]);
const BODY_TAG = /<body\b[^>]*>/i;
const SECTION_TAG = /<section\b[^>]*>/i;

function hasFrontBackType(types: readonly string[]): boolean {
  return types.some((type) => FRONT_BACK_TYPES.has(type));
}

function elementTypes(tag: string | undefined): string[] {
  return tag ? typeTokens(attributesOf(tag)["epub:type"]) : [];
}

function fragmentTag(html: string, fragment: string): string | undefined {
  if (!fragment) {
    return undefined;
  }
  const escaped = fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`<[A-Za-z][^>]*\\bid\\s*=\\s*"${escaped}"[^>]*>`, "i").exec(html)?.[0];
}

function documentTypes(document: SourceDocument, fragment: string): string[] {
  return [
    ...elementTypes(BODY_TAG.exec(document.html)?.[0]),
    ...elementTypes(SECTION_TAG.exec(document.html)?.[0]),
    ...elementTypes(fragmentTag(document.html, fragment)),
  ];
}

function isMarkedFrontBackMatter(target: EntryTarget, document: SourceDocument): boolean {
  return (
    !document.linear ||
    hasFrontBackType([...target.entry.types, ...documentTypes(document, target.fragment)])
  );
}

export function resolveEntries(
  targets: readonly EntryTarget[],
  documents: readonly SourceDocument[],
): ResolvedEntry[] {
  const resolved: Omit<ResolvedEntry, "marked">[] = [];
  const kept: EntryTarget[] = [];
  for (const target of targets) {
    const documentIndex = documents.findIndex((document) => document.path === target.path);
    const document = documents[documentIndex];
    if (!document) {
      continue;
    }
    const blockIndex = target.fragment ? (document.anchors.get(target.fragment) ?? 0) : 0;
    resolved.push({ label: target.entry.label, documentIndex, blockIndex });
    kept.push(target);
  }
  return resolved.map((entry, index) => {
    const target = kept[index] as EntryTarget;
    const document = documents[entry.documentIndex] as SourceDocument;
    return {
      ...entry,
      marked: isMarkedFrontBackMatter(target, document),
    };
  });
}

export const MIN_DOCUMENT_TOKENS = 150;

export function sortByPosition(entries: readonly ResolvedEntry[]): ResolvedEntry[] {
  return entries
    .map((entry, order) => ({ entry, order }))
    .sort(
      (a, b) =>
        a.entry.documentIndex - b.entry.documentIndex ||
        a.entry.blockIndex - b.entry.blockIndex ||
        a.order - b.order,
    )
    .map(({ entry }) => entry);
}

export function segmentOwners(
  documents: readonly SourceDocument[],
  entries: readonly ResolvedEntry[],
): Map<TextBlock, number> {
  const owners = new Map<TextBlock, number>();
  let current = -1;
  documents.forEach((document, documentIndex) => {
    document.blocks.forEach((block, blockIndex) => {
      while (current + 1 < entries.length) {
        const next = entries[current + 1] as ResolvedEntry;
        const started =
          next.documentIndex < documentIndex ||
          (next.documentIndex === documentIndex && next.blockIndex <= blockIndex);
        if (!started) {
          break;
        }
        current += 1;
      }
      if (current >= 0) {
        owners.set(block, current);
      }
    });
  });
  return owners;
}
