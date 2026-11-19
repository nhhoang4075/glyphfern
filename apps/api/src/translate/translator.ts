export interface Translator {
  readonly name: string;
  translate(text: string, source: string, target: string): Promise<string>;
}

export class TranslatorError extends Error {}
