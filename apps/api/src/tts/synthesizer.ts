export interface SynthesisInput {
  voice: string;
  text: string;
  speed: number;
}

export interface Synthesizer {
  synthesize(input: SynthesisInput): Promise<Uint8Array>;
}

export class SynthesizerError extends Error {}
