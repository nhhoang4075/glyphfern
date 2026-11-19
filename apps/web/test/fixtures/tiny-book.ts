import { type Book, type Sentence, parseTokens } from "@glyphfern/core";

function sentence(id: number, kind: Sentence["kind"], text: string): Sentence {
  return { id, chapter: 0, kind, tokens: parseTokens(text) };
}

export const TINY_BOOK: Book = {
  id: "tiny-book",
  title: "Tiny",
  lang: "es",
  chapters: [
    {
      title: sentence(0, "title", "I"),
      paragraphs: [
        [
          sentence(
            1,
            "body",
            "Había|haber una|un vez|vez una|un niña|niña que|que vivía|vivir cerca|cerca del|del bosque.|bosque",
          ),
          sentence(
            2,
            "body",
            "El|el lobo|lobo se|irse|g fue|irse|g corriendo|correr por|por el|el camino.|camino",
          ),
        ],
      ],
    },
  ],
};
