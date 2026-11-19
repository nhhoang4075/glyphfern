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

export interface LexiconRow {
  word: string;
  pos: string;
  ipa: string | null;
  glosses: string[];
  lemma: string | null;
  facts: EntryFacts | null;
}

interface KaikkiSense {
  glosses?: string[];
  form_of?: { word?: string }[];
  alt_of?: { word?: string }[];
  tags?: string[];
}

interface KaikkiForm {
  form?: string;
  tags?: string[];
}

interface KaikkiEntry {
  word?: string;
  pos?: string;
  lang_code?: string;
  senses?: KaikkiSense[];
  sounds?: { ipa?: string }[];
  forms?: KaikkiForm[];
}

const MAX_GLOSSES = 6;
const MAX_GLOSS_LENGTH = 160;
const DEPRIORITIZED_TAGS = new Set(["obsolete", "archaic", "rare", "dated", "historical"]);
const GENDER_TAGS = new Set(["masculine", "feminine", "by-personal-gender"]);
const NUMBER_TAGS = new Set(["plural-only", "uncountable", "invariable"]);
const NOUN_LIKE_POS = new Set(["noun", "adj", "det", "pron", "num"]);
const MAX_FORMS_PER_KIND = 2;
const LABEL_TAGS = new Set([
  "colloquial",
  "slang",
  "vulgar",
  "derogatory",
  "offensive",
  "figuratively",
  "informal",
  "familiar",
  "formal",
  "euphemistic",
  "humorous",
  "literary",
  "poetic",
  "childish",
  "nonstandard",
  "idiomatic",
  "neologism",
  "endearing",
  "obsolete",
  "archaic",
  "dated",
  "historical",
  "rare",
  "uncommon",
  "regional",
  "dialectal",
  "Spain",
  "Andalusia",
  "Aragon",
  "Asturias",
  "Galicia",
  "Canary-Islands",
  "Mexico",
  "Guatemala",
  "El-Salvador",
  "Honduras",
  "Nicaragua",
  "Costa-Rica",
  "Panama",
  "Central-America",
  "Cuba",
  "Dominican-Republic",
  "Puerto-Rico",
  "Caribbean",
  "Colombia",
  "Venezuela",
  "Ecuador",
  "Peru",
  "Bolivia",
  "Chile",
  "Argentina",
  "Uruguay",
  "Paraguay",
  "Rioplatense",
  "Lunfardo",
  "South-America",
  "Latin-America",
  "US",
  "Philippines",
]);

function formOf(sense: KaikkiSense): string | undefined {
  return sense.form_of?.[0]?.word ?? sense.alt_of?.[0]?.word;
}

function isPreferred(sense: KaikkiSense): boolean {
  return !(sense.tags ?? []).some((tag) => DEPRIORITIZED_TAGS.has(tag));
}

function glossOf(sense: KaikkiSense): string | undefined {
  const gloss = sense.glosses?.[sense.glosses.length - 1]?.trim();
  return gloss ? gloss.slice(0, MAX_GLOSS_LENGTH) : undefined;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function formsTagged(forms: KaikkiForm[], tags: string[]): string[] {
  const wanted = [...tags].sort().join(" ");
  return unique(
    forms.flatMap((form) =>
      form.form && [...(form.tags ?? [])].sort().join(" ") === wanted ? [form.form] : [],
    ),
  );
}

function regularForms(infinitive: string): string[] | undefined {
  const stem = infinitive.slice(0, -2);
  if (infinitive.endsWith("ar")) {
    return [`${stem}o`, `${stem}é`, `${stem}ó`, `${stem}ado`, `${stem}ando`];
  }
  if (infinitive.endsWith("er") || infinitive.endsWith("ir")) {
    return [`${stem}o`, `${stem}í`, `${stem}ió`, `${stem}ido`, `${stem}iendo`];
  }
  return undefined;
}

function unusualFormsOf(word: string, forms: KaikkiForm[]): string[] {
  const regular = regularForms(word);
  if (!regular) {
    return [];
  }
  const actual = [
    formsTagged(forms, ["first-person", "indicative", "present", "singular"])[0],
    formsTagged(forms, ["first-person", "indicative", "preterite", "singular"])[0],
    formsTagged(forms, ["indicative", "preterite", "singular", "third-person"])[0],
    formsTagged(forms, ["masculine", "participle", "past", "singular"])[0],
    formsTagged(forms, ["gerund"])[0],
  ];
  return unique(actual.flatMap((form, index) => (form && form !== regular[index] ? [form] : [])));
}

function factsOf(entry: KaikkiEntry, chosen: KaikkiSense[], labelled: KaikkiSense[]): EntryFacts {
  const forms = entry.forms ?? [];
  const isVerb = entry.pos === "verb";
  const isNounLike = NOUN_LIKE_POS.has(entry.pos ?? "");
  const tagsOf = (sense: KaikkiSense) => sense.tags ?? [];
  return {
    gender: isNounLike
      ? unique(chosen.flatMap((sense) => tagsOf(sense).filter((tag) => GENDER_TAGS.has(tag))))
      : [],
    number: isNounLike
      ? [...NUMBER_TAGS].filter(
          (tag) => chosen.length > 0 && chosen.every((sense) => tagsOf(sense).includes(tag)),
        )
      : [],
    plural: isNounLike ? formsTagged(forms, ["plural"]).slice(0, MAX_FORMS_PER_KIND) : [],
    feminine: isNounLike ? formsTagged(forms, ["feminine"]).slice(0, MAX_FORMS_PER_KIND) : [],
    senseLabels: labelled.map((sense) =>
      unique(tagsOf(sense).filter((tag) => LABEL_TAGS.has(tag))),
    ),
    alternations: isVerb
      ? unique(
          forms.flatMap((form) =>
            (form.tags ?? []).includes("class") && form.form?.endsWith(" alternation")
              ? [form.form.slice(0, -" alternation".length)]
              : [],
          ),
        )
      : [],
    irregular: isVerb && forms.some((form) => form.form === "irregular"),
    unusualForms: isVerb && entry.word ? unusualFormsOf(entry.word, forms) : [],
  };
}

function hasFacts(facts: EntryFacts): boolean {
  return (
    facts.gender.length > 0 ||
    facts.number.length > 0 ||
    facts.plural.length > 0 ||
    facts.feminine.length > 0 ||
    facts.senseLabels.some((labels) => labels.length > 0) ||
    facts.alternations.length > 0 ||
    facts.irregular ||
    facts.unusualForms.length > 0
  );
}

export function parseKaikkiLine(line: string, lang: string): LexiconRow | undefined {
  let entry: KaikkiEntry;
  try {
    entry = JSON.parse(line) as KaikkiEntry;
  } catch {
    return undefined;
  }
  if (entry.lang_code !== lang || !entry.word || !entry.pos) {
    return undefined;
  }
  const senses = entry.senses ?? [];
  const ipa = entry.sounds?.find((sound) => sound.ipa)?.ipa ?? null;
  const lemma =
    senses.length > 0 && senses.every((sense) => formOf(sense))
      ? formOf(senses[0] as KaikkiSense)
      : undefined;
  if (lemma) {
    return {
      word: entry.word,
      pos: entry.pos,
      ipa,
      glosses: [],
      lemma: lemma.toLowerCase(),
      facts: null,
    };
  }
  const usable = senses.filter((sense) => !formOf(sense));
  const preferred = usable.filter(isPreferred);
  const chosen = preferred.length > 0 ? preferred : usable;
  const glossed = chosen
    .flatMap((sense) => {
      const gloss = glossOf(sense);
      return gloss ? [{ gloss, sense }] : [];
    })
    .slice(0, MAX_GLOSSES);
  if (glossed.length === 0) {
    return undefined;
  }
  const facts = factsOf(
    entry,
    chosen,
    glossed.map((item) => item.sense),
  );
  return {
    word: entry.word,
    pos: entry.pos,
    ipa,
    glosses: glossed.map((item) => item.gloss),
    lemma: null,
    facts: hasFacts(facts) ? facts : null,
  };
}
