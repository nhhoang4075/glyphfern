import type { TextBlock } from "./html-blocks";

const ENGLISH_WORDS = new Set(
  (
    "the and of to in is are was were that this with for you your it be by on at or from had not " +
    "will can if but which they we their our there what when about more been than its would could " +
    "should also how into my his she he's all any some these those who whom whose shall may might " +
    "because between during before after through over under again once only own same too very just " +
    "so such here out up down off then them us him her"
  ).split(" "),
);

const SPANISH_WORDS = new Set(
  (
    "el la los las de del en y que un una unos unas es se por con para su sus al lo como más pero " +
    "sin sobre está están era eran fue fueron hay muy ya le les me te mi tu nos este esta estos " +
    "estas eso esto cuando donde porque también ser son han ha había ni o si no muy todo todos " +
    "toda todas aquí allí hacia desde entre hasta mis tus nuestro qué cómo quién dónde"
  ).split(" "),
);

const SPANISH_LETTERS = /[ñáéíóúü¿¡]/gi;
const WORD_PATTERN = /[\p{L}']+/gu;
const MIN_ENGLISH_WORDS = 2;
const ENGLISH_DOMINANCE = 2;
const MIN_PROSE_WORDS = 6;
const MIN_PROSE_SPANISH_SCORE = 3;
const PUBLISHING_LINE =
  /copyright|©|all rights reserved|\bISBN\b|^[\p{L}.'’ -]+ (?:publishing|publishers|press)$/iu;

export interface LanguageScore {
  english: number;
  spanish: number;
  words: number;
}

const GLOSS_SEPARATOR = " = ";

export function scoreBlock(text: string): LanguageScore {
  const separator = text.indexOf(GLOSS_SEPARATOR);
  const scored = separator >= 0 ? text.slice(0, separator) : text;
  const words = scored.toLowerCase().match(WORD_PATTERN) ?? [];
  let english = 0;
  let spanish = scored.match(SPANISH_LETTERS)?.length ?? 0;
  for (const word of words) {
    if (ENGLISH_WORDS.has(word)) {
      english += 1;
    }
    if (SPANISH_WORDS.has(word)) {
      spanish += 1;
    }
  }
  return { english, spanish, words: words.length };
}

export function isEnglishBlock(text: string): boolean {
  const { english, spanish } = scoreBlock(text);
  return english >= MIN_ENGLISH_WORDS && english > ENGLISH_DOMINANCE * spanish;
}

function isSpanishProse(text: string): boolean {
  const { english, spanish, words } = scoreBlock(text);
  return words >= MIN_PROSE_WORDS && spanish >= MIN_PROSE_SPANISH_SCORE && english * 2 < spanish;
}

export function isPublishingLine(text: string): boolean {
  return PUBLISHING_LINE.test(text.trim());
}

export function dropEnglishBlocks(documents: readonly TextBlock[][]): TextBlock[][] {
  const flat = documents.flat();
  const firstProse = flat.findIndex((block) => isSpanishProse(block.text));
  const lastProse = flat.map((block) => isSpanishProse(block.text)).lastIndexOf(true);
  let position = -1;
  const result: TextBlock[][] = [];
  for (const blocks of documents) {
    const kept = blocks.filter((block) => {
      position += 1;
      const outsideStory = firstProse < 0 || position < firstProse || position > lastProse;
      if (isEnglishBlock(block.text)) {
        return false;
      }
      if (!outsideStory) {
        return true;
      }
      const { english, spanish } = scoreBlock(block.text);
      return !(isPublishingLine(block.text) || (english >= 1 && spanish === 0));
    });
    if (kept.length > 0) {
      result.push(kept);
    }
  }
  return result;
}
