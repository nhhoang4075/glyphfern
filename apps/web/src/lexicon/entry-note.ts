export interface EntryFacts {
  gender: string[];
  number: string[];
  plural: string[];
  feminine: string[];
  senseLabels: string[][];
  alternations: string[];
  irregular: boolean;
  unusualForms: string[];
}

const MAX_GLOSS_QUOTE = 40;

const REGISTER_LABELS: Record<string, string> = {
  colloquial: "khẩu ngữ",
  slang: "tiếng lóng",
  vulgar: "thô tục",
  derogatory: "miệt thị",
  offensive: "xúc phạm",
  figuratively: "nghĩa bóng",
  informal: "thân mật",
  familiar: "thân mật",
  formal: "trang trọng",
  euphemistic: "nói giảm",
  humorous: "hài hước",
  literary: "văn chương",
  poetic: "thơ ca",
  childish: "trẻ con",
  nonstandard: "không chuẩn",
  idiomatic: "thành ngữ",
  neologism: "từ mới",
  endearing: "âu yếm",
  obsolete: "lỗi thời",
  archaic: "cổ",
  dated: "cũ",
  historical: "lịch sử",
  rare: "hiếm",
  uncommon: "ít dùng",
  regional: "phương ngữ",
  dialectal: "phương ngữ",
};

const REGION_LABELS: Record<string, string> = {
  Spain: "Tây Ban Nha",
  Andalusia: "Andalucía",
  Aragon: "Aragón",
  Asturias: "Asturias",
  Galicia: "Galicia",
  "Canary-Islands": "quần đảo Canarias",
  Mexico: "Mexico",
  Guatemala: "Guatemala",
  "El-Salvador": "El Salvador",
  Honduras: "Honduras",
  Nicaragua: "Nicaragua",
  "Costa-Rica": "Costa Rica",
  Panama: "Panama",
  "Central-America": "Trung Mỹ",
  Cuba: "Cuba",
  "Dominican-Republic": "Cộng hòa Dominica",
  "Puerto-Rico": "Puerto Rico",
  Caribbean: "vùng Caribe",
  Colombia: "Colombia",
  Venezuela: "Venezuela",
  Ecuador: "Ecuador",
  Peru: "Peru",
  Bolivia: "Bolivia",
  Chile: "Chile",
  Argentina: "Argentina",
  Uruguay: "Uruguay",
  Paraguay: "Paraguay",
  Rioplatense: "vùng Río de la Plata",
  Lunfardo: "lunfardo (Buenos Aires)",
  "South-America": "Nam Mỹ",
  "Latin-America": "châu Mỹ Latinh",
  US: "Mỹ",
  Philippines: "Philippines",
};

const NUMBER_LABELS: Record<string, string> = {
  "plural-only": "Chỉ dùng số nhiều",
  uncountable: "Không đếm được",
  invariable: "Không đổi dạng",
};

const VOWEL_CHANGES = new Set([
  "e-ie",
  "o-ue",
  "e-i",
  "e-ie-i",
  "o-ue-u",
  "i-ie",
  "u-ue",
  "e-ye-i",
  "e-ye",
  "o-hue",
]);
const ACCENT_CHANGES = new Set(["i-í", "u-ú", "e-í"]);
const IGNORED_CHANGES = new Set(["hard-soft"]);

function genderSentence(gender: string[]): string | undefined {
  const masculine = gender.includes("masculine");
  const feminine = gender.includes("feminine");
  if (gender.includes("by-personal-gender")) {
    return "Giống đực hoặc cái tùy người";
  }
  if (masculine && feminine) {
    return "Giống đực hoặc cái tùy nghĩa";
  }
  if (masculine) {
    return "Giống đực";
  }
  return feminine ? "Giống cái" : undefined;
}

function alternationSentence(alternations: string[]): string | undefined {
  const parts = alternations
    .filter((change) => !IGNORED_CHANGES.has(change))
    .map((change) => {
      const arrow = change.replaceAll("-", "→");
      if (VOWEL_CHANGES.has(change)) {
        return `Biến âm thân từ ${arrow}`;
      }
      return ACCENT_CHANGES.has(change) ? `Đổi dấu nhấn ${arrow}` : `Đổi chính tả ${arrow}`;
    });
  return parts.length > 0 ? parts.join(". ") : undefined;
}

function quoted(gloss: string): string {
  const short = gloss.length > MAX_GLOSS_QUOTE ? `${gloss.slice(0, MAX_GLOSS_QUOTE - 1)}…` : gloss;
  return `“${short}”`;
}

function labelsSentence(gloss: string, tags: string[]): string | undefined {
  const registers = tags.flatMap((tag) => REGISTER_LABELS[tag] ?? []);
  const regions = tags.flatMap((tag) => REGION_LABELS[tag] ?? []);
  const parts = [...registers, ...(regions.length > 0 ? [`dùng ở ${regions.join(", ")}`] : [])];
  return parts.length > 0 ? `${quoted(gloss)}: ${parts.join(", ")}` : undefined;
}

export function buildNote(
  facts: EntryFacts | null | undefined,
  glosses: string[],
): string | undefined {
  if (!facts) {
    return undefined;
  }
  const sentences = [
    genderSentence(facts.gender),
    ...facts.number.map((tag) => NUMBER_LABELS[tag]),
    facts.plural.length > 0 ? `Số nhiều: ${facts.plural.join(", ")}` : undefined,
    facts.feminine.length > 0 ? `Giống cái: ${facts.feminine.join(", ")}` : undefined,
    facts.irregular ? "Động từ bất quy tắc" : undefined,
    alternationSentence(facts.alternations),
    facts.unusualForms.length > 0
      ? `Dạng chia khác thường: ${facts.unusualForms.join(", ")}`
      : undefined,
    ...glosses.map((gloss, index) => labelsSentence(gloss, facts.senseLabels[index] ?? [])),
  ].filter((sentence): sentence is string => sentence !== undefined);
  return sentences.length > 0 ? `${sentences.join(". ")}.` : undefined;
}
