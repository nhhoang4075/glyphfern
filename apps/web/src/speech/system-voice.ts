import type { SpeechRequest, Tts } from "./tts";

export interface SpeechSynthesisLike {
  speak(utterance: SpeechSynthesisUtterance): void;
  cancel(): void;
}

export interface SystemVoiceDependencies {
  synthesis: () => SpeechSynthesisLike | undefined;
  createUtterance: (text: string) => SpeechSynthesisUtterance;
}

const browserDependencies: SystemVoiceDependencies = {
  synthesis: () => window.speechSynthesis,
  createUtterance: (text) => new SpeechSynthesisUtterance(text),
};

export function createSystemVoice(
  dependencies: SystemVoiceDependencies = browserDependencies,
): Tts {
  return {
    speak(request: SpeechRequest) {
      try {
        const synthesis = dependencies.synthesis();
        if (!synthesis) {
          return;
        }
        const utterance = dependencies.createUtterance(request.text);
        utterance.lang = request.locale;
        utterance.rate = request.rate;
        synthesis.cancel();
        synthesis.speak(utterance);
      } catch {
        return;
      }
    },
    cancel() {
      try {
        dependencies.synthesis()?.cancel();
      } catch {
        return;
      }
    },
  };
}
