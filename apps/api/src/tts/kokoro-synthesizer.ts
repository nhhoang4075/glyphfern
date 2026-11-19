import { type SynthesisInput, type Synthesizer, SynthesizerError } from "./synthesizer";

export interface KokoroOptions {
  url: string;
  timeoutMs?: number;
  retryWindowMs?: number;
  fetcher?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_RETRY_WINDOW_MS = 35_000;
const RETRY_DELAY_MS = 1_500;
const WAKING_STATUSES = new Set([502, 503, 504]);

type Attempt = { response: Response } | { waking: SynthesizerError };

export function createKokoroSynthesizer(options: KokoroOptions): Synthesizer {
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retryWindowMs = options.retryWindowMs ?? DEFAULT_RETRY_WINDOW_MS;
  const sleep =
    options.sleep ?? ((ms: number) => new Promise<void>((done) => setTimeout(done, ms)));
  const now = options.now ?? Date.now;
  const endpoint = `${options.url.replace(/\/+$/, "")}/synthesize`;

  async function attempt(body: string, remainingMs: number): Promise<Attempt> {
    let response: Response;
    try {
      response = await fetcher(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        signal: AbortSignal.timeout(Math.max(1, Math.min(timeoutMs, remainingMs))),
      });
    } catch (error) {
      return { waking: new SynthesizerError(`speech request failed: ${String(error)}`) };
    }
    if (WAKING_STATUSES.has(response.status)) {
      return {
        waking: new SynthesizerError(`speech request failed with ${response.status}`),
      };
    }
    return { response };
  }

  return {
    async synthesize({ voice, text, speed }: SynthesisInput) {
      const body = JSON.stringify({ text, voice, speed });
      const deadline = now() + retryWindowMs;
      let result = await attempt(body, Math.max(timeoutMs, deadline - now()));
      while ("waking" in result) {
        if (now() + RETRY_DELAY_MS >= deadline) {
          throw result.waking;
        }
        await sleep(RETRY_DELAY_MS);
        result = await attempt(body, deadline - now());
      }
      const { response } = result;
      if (response.status !== 200) {
        throw new SynthesizerError(`speech request failed with ${response.status}`);
      }
      let audio: Uint8Array;
      try {
        audio = new Uint8Array(await response.arrayBuffer());
      } catch (error) {
        throw new SynthesizerError(`speech reply could not be read: ${String(error)}`);
      }
      if (audio.length === 0) {
        throw new SynthesizerError("speech reply had no audio");
      }
      return audio;
    },
  };
}
