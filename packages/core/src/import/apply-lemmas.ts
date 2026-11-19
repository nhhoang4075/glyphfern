import type { Book } from "../types";

export function bookWords(book: Book): string[] {
  const words = new Set<string>();
  for (const chapter of book.chapters) {
    for (const sentence of [chapter.title, ...chapter.paragraphs.flat()]) {
      for (const token of sentence.tokens) {
        words.add(token.surf.toLowerCase());
      }
    }
  }
  return [...words];
}

export function applyLemmas(book: Book, lemmas: Readonly<Record<string, string>>): Book {
  const lemmaOf = (surface: string): string => {
    const key = surface.toLowerCase();
    const value = Object.hasOwn(lemmas, key) ? lemmas[key] : undefined;
    return typeof value === "string" && value.length > 0 ? value : key;
  };
  const mapSentence = <T extends Book["chapters"][number]["title"]>(sentence: T): T => ({
    ...sentence,
    tokens: sentence.tokens.map((token) => ({ ...token, lemma: lemmaOf(token.surf) })),
  });
  return {
    ...book,
    chapters: book.chapters.map((chapter) => ({
      title: mapSentence(chapter.title),
      paragraphs: chapter.paragraphs.map((paragraph) => paragraph.map(mapSentence)),
    })),
  };
}
