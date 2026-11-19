import { type SynthesisInput, type Synthesizer, SynthesizerError } from "./synthesizer";

export interface KokoroOptions {
  url: string;
  timeoutMs?: number;
  fetcher?: typeof fetch;
}

const DEFAULT_TIMEOUT_MS = 30_000;

export function createKokoroSynthesizer(options: KokoroOptions): Synthesizer {
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const endpoint = `${options.url.replace(/\/+$/, "")}/synthesize`;
  return {
    async synthesize({ voice, text, speed }: SynthesisInput) {
      let response: Response;
      try {
        response = await fetcher(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text, voice, speed }),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        throw new SynthesizerError(`speech request failed: ${String(error)}`);
      }
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
