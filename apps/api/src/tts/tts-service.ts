import { BudgetExceededError, type DailyBudget, hashText } from "../translate/translate-service";
import type { Synthesizer } from "./synthesizer";

export interface TtsCache {
  get(hash: string): Promise<Uint8Array | undefined>;
  put(hash: string, audio: Uint8Array): Promise<void>;
}

export interface TtsRequest {
  lang: string;
  text: string;
  speed: number;
}

export interface TtsResult {
  audio: Uint8Array;
  cached: boolean;
}

export interface TtsService {
  synthesize(request: TtsRequest): Promise<TtsResult>;
}

export type VoicesByLanguage = Readonly<Record<string, string>>;

export function roundSpeed(speed: number): number {
  return Math.round(speed * 100) / 100;
}

export function cacheKey(voice: string, speed: number, text: string): Promise<string> {
  return hashText(`${voice}|${speed}|${text}`);
}

export function createTtsService(
  synthesizer: Synthesizer,
  cache: TtsCache,
  budget: DailyBudget,
  voices: VoicesByLanguage,
): TtsService {
  return {
    async synthesize({ lang, text, speed }) {
      const voice = voices[lang];
      if (voice === undefined) {
        throw new Error(`no voice configured for ${lang}`);
      }
      const rounded = roundSpeed(speed);
      const hash = await cacheKey(voice, rounded, text);
      const hit = await cache.get(hash);
      if (hit !== undefined) {
        return { audio: hit, cached: true };
      }
      if (!budget.tryConsume(text.length)) {
        throw new BudgetExceededError("daily speech budget is used up");
      }
      const audio = await synthesizer.synthesize({ voice, text, speed: rounded });
      await cache.put(hash, audio);
      return { audio, cached: false };
    },
  };
}
