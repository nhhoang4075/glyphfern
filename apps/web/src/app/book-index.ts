import type { Book, Sentence } from "@glyphfern/core";

export interface BookIndex {
  sentences: readonly Sentence[];
  bodySentences: readonly Sentence[];
  byId: ReadonlyMap<number, Sentence>;
}

const cache = new WeakMap<Book, BookIndex>();

export function indexBook(book: Book): BookIndex {
  const cached = cache.get(book);
  if (cached) {
    return cached;
  }
  const sentences: Sentence[] = [];
  const bodySentences: Sentence[] = [];
  for (const chapter of book.chapters) {
    sentences.push(chapter.title);
    for (const paragraph of chapter.paragraphs) {
      for (const sentence of paragraph) {
        sentences.push(sentence);
        bodySentences.push(sentence);
      }
    }
  }
  const index: BookIndex = {
    sentences,
    bodySentences,
    byId: new Map(sentences.map((sentence) => [sentence.id, sentence])),
  };
  cache.set(book, index);
  return index;
}

export function firstOccurrence(book: Book, lemma: string): Sentence | undefined {
  const { bodySentences } = indexBook(book);
  return bodySentences.find((sentence) => sentence.tokens.some((token) => token.lemma === lemma));
}
