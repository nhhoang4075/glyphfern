import { BudgetExceededError, type DailyBudget, hashText } from "../translate/translate-service";
import type { GrammarClient, GrammarRequest } from "./grammar-client";

export interface GrammarCache {
  get(hash: string): Promise<string[] | undefined>;
  put(hash: string, notes: string[]): Promise<void>;
}

export interface GrammarResult {
  notes: string[];
  cached: boolean;
}

export interface GrammarService {
  analyze(request: GrammarRequest): Promise<GrammarResult>;
}

export function grammarCacheKey(model: string, request: GrammarRequest): Promise<string> {
  return hashText(`${model}|${request.lang}|${request.lemma}|${request.word}|${request.sentence}`);
}

export function createGrammarService(
  client: GrammarClient,
  cache: GrammarCache,
  budget: DailyBudget,
): GrammarService {
  return {
    async analyze(request) {
      const hash = await grammarCacheKey(client.model, request);
      const hit = await cache.get(hash);
      if (hit !== undefined) {
        return { notes: hit, cached: true };
      }
      if (!budget.tryConsume(request.sentence.length)) {
        throw new BudgetExceededError("daily grammar budget is used up");
      }
      const notes = await client.analyze(request);
      await cache.put(hash, notes);
      return { notes, cached: false };
    },
  };
}
