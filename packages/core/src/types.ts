export type Lang = "es";

export interface Morpheme {
  form: string;
  gloss: string;
}

export interface Token {
  lead: string;
  surf: string;
  trail: string;
  lemma: string;
  group?: string;
  morphemes?: Morpheme[];
}

export interface Sentence {
  id: number;
  chapter: number;
  kind: "title" | "body";
  tokens: Token[];
  vi?: string;
  notes?: string[];
}

export interface Chapter {
  title: Sentence;
  paragraphs: Sentence[][];
}

export interface Book {
  id: string;
  title: string;
  lang: Lang;
  chapters: Chapter[];
}

export type LearningLevel = 1 | 2 | 3;

export type WordState =
  | { kind: "new" }
  | { kind: "learning"; level: LearningLevel }
  | { kind: "known" };

export type Rating = "again" | "hard" | "good" | "easy";

export interface DictEntry {
  pos: string;
  pronunciation: string;
  meaning: string;
  note?: string;
}

export interface LanguagePack {
  lang: Lang;
  ttsLocale: string;
  pronunciationKind: "ipa" | "romanization";
  wordBreak: "normal" | "keep-all";
  hyphenate: boolean;
  book: Book;
  dict: Record<string, DictEntry>;
}
