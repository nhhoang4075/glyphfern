import type { Book, Sentence } from "@glyphfern/core";

const wordCountCache = new WeakMap<Book, readonly number[]>();

function sentenceWords(sentence: Sentence): number {
  return sentence.tokens.length;
}

function countChapterWords(book: Book): number[] {
  return book.chapters.map((chapter) => {
    let words = sentenceWords(chapter.title);
    for (const paragraph of chapter.paragraphs) {
      for (const sentence of paragraph) words += sentenceWords(sentence);
    }
    return words;
  });
}

export function chapterWordCounts(book: Book): readonly number[] {
  const cached = wordCountCache.get(book);
  if (cached) return cached;
  const counts = countChapterWords(book);
  wordCountCache.set(book, counts);
  return counts;
}

export function wordsBefore(wordCounts: readonly number[], chapter: number): number {
  return wordCounts.slice(0, chapter).reduce((sum, count) => sum + count, 0);
}

export function pageFraction(page: number, chapterStartPage: number, chapterPages: number): number {
  const span = Math.max(1, chapterPages);
  return Math.min(1, Math.max(0, (page - chapterStartPage) / span));
}

export function bookProgress(
  wordCounts: readonly number[],
  chapter: number,
  chapterFraction: number,
): number {
  const total = wordCounts.reduce((sum, count) => sum + count, 0);
  if (total === 0) return 0;
  const done = wordsBefore(wordCounts, chapter) + chapterFraction * (wordCounts[chapter] ?? 0);
  return Math.min(1, Math.max(0, done / total));
}

export function sentenceProgress(book: Book, sentenceId: number): number {
  const counts = chapterWordCounts(book);
  const target = book.chapters.findIndex(
    (chapter) =>
      chapter.title.id === sentenceId ||
      chapter.paragraphs.some((paragraph) => paragraph.some((s) => s.id === sentenceId)),
  );
  const chapter = book.chapters[target];
  if (!chapter) return 0;
  let before = 0;
  let reached = chapter.title.id === sentenceId;
  const chapterWords = counts[target] ?? 0;
  if (!reached) {
    before = sentenceWords(chapter.title);
    for (const paragraph of chapter.paragraphs) {
      for (const sentence of paragraph) {
        if (sentence.id === sentenceId) reached = true;
        if (reached) break;
        before += sentenceWords(sentence);
      }
      if (reached) break;
    }
  }
  return bookProgress(counts, target, chapterWords === 0 ? 0 : before / chapterWords);
}

export function wordsPerPage(windowWordCount: number, windowPages: number): number {
  return windowWordCount / Math.max(1, windowPages);
}

export function estimatedStartPage(wordsBeforeChapter: number, perPage: number): number {
  if (perPage <= 0) return 1;
  return Math.round(wordsBeforeChapter / perPage) + 1;
}

export function currentPageNumber(
  wordCounts: readonly number[],
  chapter: number,
  chapterFraction: number,
  perPage: number,
): number {
  const before = wordsBefore(wordCounts, chapter) + chapterFraction * (wordCounts[chapter] ?? 0);
  return estimatedStartPage(before, perPage);
}
