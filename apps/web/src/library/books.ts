import type { Lang } from "@glyphfern/core";
import type { StoredBook } from "../storage/repository";

export type ArtKey = "m" | "w" | "s" | "d";

export interface LibraryBook {
  id: string;
  title: string;
  flag: string;
  colors: readonly [string, string];
  progress: number;
  art: ArtKey;
  lang: Lang;
  removable?: boolean;
}

const COVER_PALETTE: readonly (readonly [string, string])[] = [
  ["#2B5B45", "#6FA283"],
  ["#2F4E5F", "#7FA5B5"],
  ["#6B4A2A", "#C9A26B"],
  ["#5C3A6B", "#B48FC4"],
  ["#6B2A3A", "#C98595"],
  ["#3A5E8C", "#8EB4D9"],
];

function titleHash(title: string): number {
  let hash = 0;
  for (const char of title) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  }
  return hash;
}

export function userLibraryBook(stored: StoredBook): LibraryBook {
  const colors = COVER_PALETTE[titleHash(stored.book.title) % COVER_PALETTE.length] ?? [
    "#2B5B45",
    "#6FA283",
  ];
  return {
    id: stored.id,
    title: stored.book.title,
    flag: stored.lang.toUpperCase(),
    colors,
    progress: 0,
    art: "w",
    lang: stored.lang,
    removable: true,
  };
}

export function orderBooks(books: readonly LibraryBook[], pins: readonly string[]): LibraryBook[] {
  const pinned = pins.flatMap((id) => books.filter((book) => book.id === id));
  const rest = books.filter((book) => !pins.includes(book.id));
  return [...pinned, ...rest];
}
