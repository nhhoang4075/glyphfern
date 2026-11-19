export const WORD_RATE = 0.88;
export const SENTENCE_RATE = 0.78;

export function speak(text: string, locale: string, rate: number) {
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = locale;
    utterance.rate = rate;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  } catch {
    return;
  }
}
