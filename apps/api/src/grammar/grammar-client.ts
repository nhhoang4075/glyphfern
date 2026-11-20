export interface GrammarRequest {
  lang: string;
  sentence: string;
  word: string;
  lemma: string;
}

export interface GrammarClient {
  readonly model: string;
  analyze(request: GrammarRequest): Promise<string[]>;
}

export class GrammarClientError extends Error {}
