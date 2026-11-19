import { type ReactElement, type ReactNode, createElement } from "react";

const ATTRIBUTE_PATTERN = /([\w-]+)="([^"]*)"/g;
const ELEMENT_PATTERN = /<(\w+)((?:\s+[\w-]+="[^"]*")*)\s*(\/>|>)/g;
const CLOSING_PATTERN = /<\/(\w+)>/g;

const ATTRIBUTE_RENAMES: Record<string, string> = {
  class: "className",
  "stroke-width": "strokeWidth",
  "stroke-linecap": "strokeLinecap",
  "stroke-linejoin": "strokeLinejoin",
  "fill-opacity": "fillOpacity",
};

type Props = Record<string, string>;

interface ParsedNode {
  tag: string;
  props: Props;
  children: ParsedNode[];
}

function parseAttributes(source: string): Props {
  const props: Props = {};
  for (const match of source.matchAll(ATTRIBUTE_PATTERN)) {
    const name = match[1] ?? "";
    props[ATTRIBUTE_RENAMES[name] ?? name] = match[2] ?? "";
  }
  return props;
}

function tokenize(markup: string) {
  const events: { index: number; kind: "open" | "self" | "close"; tag: string; props: Props }[] =
    [];
  for (const match of markup.matchAll(ELEMENT_PATTERN)) {
    events.push({
      index: match.index ?? 0,
      kind: match[3] === "/>" ? "self" : "open",
      tag: match[1] ?? "",
      props: parseAttributes(match[2] ?? ""),
    });
  }
  for (const match of markup.matchAll(CLOSING_PATTERN)) {
    events.push({ index: match.index ?? 0, kind: "close", tag: match[1] ?? "", props: {} });
  }
  return events.sort((a, b) => a.index - b.index);
}

export function parseMarkup(markup: string): ParsedNode[] {
  const root: ParsedNode = { tag: "root", props: {}, children: [] };
  const stack: ParsedNode[] = [root];
  for (const event of tokenize(markup)) {
    const parent = stack[stack.length - 1] ?? root;
    if (event.kind === "close") {
      stack.pop();
      continue;
    }
    const node: ParsedNode = { tag: event.tag, props: event.props, children: [] };
    parent.children.push(node);
    if (event.kind === "open") {
      stack.push(node);
    }
  }
  return root.children;
}

export function renderNodes(nodes: readonly ParsedNode[], keyPrefix = "n"): ReactNode[] {
  return nodes.map((node, position): ReactElement => {
    const key = `${keyPrefix}-${node.tag}-${position}`;
    return createElement(node.tag, { key, ...node.props }, ...renderNodes(node.children, key));
  });
}
