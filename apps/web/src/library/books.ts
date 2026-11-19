import type { Lang } from "@glyphfern/core";
import { packs } from "@glyphfern/languages";
import type { StoredBook } from "../storage/repository";

export type ArtKey = "m" | "w" | "s" | "d";

export interface LibraryBook {
  id: string;
  title: string;
  flag: string;
  colors: readonly [string, string];
  progress: number;
  art: ArtKey;
  lang: Lang | null;
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

const placeholderBooks: Record<string, Omit<LibraryBook, "id">> = {
  "platero-y-yo": {
    title: "Platero y yo",
    flag: "ES",
    colors: ["#4A6B2A", "#B5CB6A"],
    progress: 0.12,
    art: "w",
    lang: null,
  },
  "don-quijote": {
    title: "Don Quijote",
    flag: "ES",
    colors: ["#2F4E5F", "#7FA5B5"],
    progress: 0.02,
    art: "s",
    lang: null,
  },
  rotkappchen: {
    title: "Rotkäppchen",
    flag: "DE",
    colors: ["#5C6B3A", "#A9B67B"],
    progress: 0,
    art: "d",
    lang: null,
  },
};

function withId(id: string): LibraryBook {
  const book = placeholderBooks[id];
  if (!book) {
    throw new Error(`Unknown placeholder book: ${id}`);
  }
  return { id, ...book };
}

export const LIBRARY_BOOKS: readonly LibraryBook[] = [
  {
    id: packs.es.book.id,
    title: packs.es.book.title,
    flag: "ES",
    colors: ["#2B5B45", "#6FA283"],
    progress: 0.35,
    art: "m",
    lang: "es",
  },
  withId("platero-y-yo"),
  withId("don-quijote"),
  withId("rotkappchen"),
  {
    id: packs.ko.book.id,
    title: packs.ko.book.title,
    flag: "KO",
    colors: ["#C0533F", "#EFA27F"],
    progress: 0,
    art: "w",
    lang: "ko",
  },
];

export function orderBooks(books: readonly LibraryBook[], pins: readonly string[]): LibraryBook[] {
  const pinned = pins.flatMap((id) => books.filter((book) => book.id === id));
  const rest = books.filter((book) => !pins.includes(book.id));
  return [...pinned, ...rest];
}
