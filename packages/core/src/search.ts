import type { Sentence, Token } from "./types";

export interface SearchResult {
  sentenceId: number;
  tokenIndexes: number[];
}

export function search(sentences: readonly Sentence[], rawQuery: string): SearchResult[] {
  const query = rawQuery.trim().toLowerCase();
  if (query.length === 0) {
    return [];
  }

  const results: SearchResult[] = [];
  for (const sentence of sentences) {
    const tokenIndexes = matchingTokenIndexes(sentence.tokens, query);
    if (tokenIndexes.length > 0) {
      results.push({ sentenceId: sentence.id, tokenIndexes });
    }
  }
  return results;
}

function matchingTokenIndexes(tokens: readonly Token[], query: string): number[] {
  const indexes: number[] = [];
  tokens.forEach((token, index) => {
    if (tokenMatches(token, query)) {
      indexes.push(index);
    }
  });
  return indexes;
}

function tokenMatches(token: Token, query: string): boolean {
  return [token.lemma, token.surf].some((candidate) => {
    const normalized = candidate.toLowerCase();
    return normalized === query || normalized.startsWith(query);
  });
}
