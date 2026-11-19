import { type Translator, TranslatorError } from "./translator";

export interface TranslationCache {
  get(source: string, target: string, hash: string): Promise<string | undefined>;
  put(
    source: string,
    target: string,
    hash: string,
    text: string,
    translated: string,
    provider: string,
  ): Promise<void>;
}

export interface DailyBudget {
  tryConsume(characters: number): boolean;
}

export class BudgetExceededError extends Error {}

export async function hashText(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createDailyBudget(limit: number, now: () => Date = () => new Date()): DailyBudget {
  let day = "";
  let used = 0;
  return {
    tryConsume(characters) {
      const today = now().toISOString().slice(0, 10);
      if (today !== day) {
        day = today;
        used = 0;
      }
      if (used + characters > limit) {
        return false;
      }
      used += characters;
      return true;
    },
  };
}

export interface TranslateService {
  translateAll(texts: readonly string[], source: string, target: string): Promise<string[]>;
}

export function createTranslateService(
  translator: Translator,
  cache: TranslationCache,
  budget: DailyBudget,
): TranslateService {
  async function one(text: string, source: string, target: string): Promise<string> {
    const hash = await hashText(text);
    const cached = await cache.get(source, target, hash);
    if (cached !== undefined) {
      return cached;
    }
    if (!budget.tryConsume(text.length)) {
      throw new BudgetExceededError("daily translation budget is used up");
    }
    const translated = await translator.translate(text, source, target);
    await cache.put(source, target, hash, text, translated, translator.name);
    return translated;
  }
  return {
    async translateAll(texts, source, target) {
      const results: string[] = [];
      for (const text of texts) {
        results.push(await one(text, source, target));
      }
      return results;
    },
  };
}

export { TranslatorError };
