export const WORD_RATE = 0.88;
export const SENTENCE_RATE = 0.78;

export interface SpeechRequest {
  text: string;
  lang: string;
  locale: string;
  rate: number;
}

export interface Tts {
  speak(request: SpeechRequest): void;
  cancel(): void;
}
