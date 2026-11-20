import type { GrammarRequest } from "./grammar-client";

export const MAX_NOTES = 4;
export const MIN_NOTES = 2;
export const MAX_NOTE_CHARS = 160;

const TERMINOLOGY = [
  "presente de indicativo = thì hiện tại",
  "pretérito indefinido = thì quá khứ đơn",
  "pretérito imperfecto = thì quá khứ chưa hoàn thành",
  "pretérito perfecto compuesto = thì hiện tại hoàn thành",
  "pluscuamperfecto = thì quá khứ hoàn thành",
  "futuro simple = thì tương lai đơn",
  "condicional = thức điều kiện",
  "indicativo = thức chỉ định; subjuntivo = thức giả định (presente de subjuntivo = giả định hiện tại; imperfecto de subjuntivo = giả định quá khứ chưa hoàn thành)",
  "imperativo = thức mệnh lệnh",
  "infinitivo = động từ nguyên thể",
  "gerundio = hiện tại phân từ (dạng đuôi -ando/-iendo)",
  "participio = quá khứ phân từ (dạng đuôi -ado/-ido hoặc bất quy tắc)",
  "sujeto = chủ ngữ; complemento directo = tân ngữ trực tiếp; complemento indirecto = tân ngữ gián tiếp",
  "pronombre reflexivo = đại từ phản thân; preposición = giới từ",
  "oración subordinada = mệnh đề phụ; oración condicional = câu điều kiện",
  "primera/segunda/tercera persona = ngôi thứ nhất/thứ hai/thứ ba; singular/plural = số ít/số nhiều; masculino/femenino = giống đực/giống cái",
];

export const GRAMMAR_SYSTEM_PROMPT = [
  "You are a Spanish grammar tutor for a Vietnamese learner.",
  'You receive ONE Spanish sentence, the tapped surface form of a word in it, and that word\'s lemma, as JSON: {"lang","sentence","word","lemma"}.',
  `Explain the grammar of that word in this sentence, in Vietnamese. Write ${MIN_NOTES} to ${MAX_NOTES} short notes, each at most ${MAX_NOTE_CHARS} characters.`,
  "Cover what applies: tense, mood and person, agreement, the role of the word in the clause, and any idiom it belongs to. When the word is a gerundio or a participio, mention its ending. Do not translate the whole sentence and do not comment on other words.",
  "Terminology: use exactly these Vietnamese terms and put the Spanish name in parentheses the first time it appears in a note.",
  TERMINOLOGY.map((entry) => `- ${entry}`).join("\n"),
  'Always write Vietnamese with full diacritics (for example "tú", "ngôi", "giả định").',
  "Ambiguity: when a form fits two readings and the sentence does not settle it, say so in one short clause instead of asserting one reading with certainty.",
  'Reply with a JSON object {"notes": [...]} and nothing else.',
].join("\n\n");

export const GRAMMAR_RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "grammar_notes",
    strict: true,
    schema: {
      type: "object",
      properties: { notes: { type: "array", items: { type: "string" } } },
      required: ["notes"],
      additionalProperties: false,
    },
  },
} as const;

export function grammarUserPrompt(request: GrammarRequest): string {
  return JSON.stringify({
    lang: request.lang,
    sentence: request.sentence,
    word: request.word,
    lemma: request.lemma,
  });
}
