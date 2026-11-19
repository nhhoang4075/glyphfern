import { describe, expect, test } from "bun:test";
import { type SpeechSynthesisLike, createSystemVoice } from "../../src/speech/system-voice";
import { SENTENCE_RATE, WORD_RATE } from "../../src/speech/tts";

interface FakeUtterance {
  text: string;
  lang: string;
  rate: number;
}

function setup() {
  const events: string[] = [];
  const utterances: FakeUtterance[] = [];
  const synthesis: SpeechSynthesisLike = {
    cancel: () => events.push("cancel"),
    speak: (utterance) => {
      events.push("speak");
      utterances.push(utterance as unknown as FakeUtterance);
    },
  };
  const voice = createSystemVoice({
    synthesis: () => synthesis,
    createUtterance: (text) => ({ text, lang: "", rate: 1 }) as unknown as SpeechSynthesisUtterance,
  });
  return { voice, events, utterances };
}

const request = { text: "lobo", lang: "es", locale: "es-ES", rate: 0.88 };

describe("system voice", () => {
  test("rates come from the spec: 0.88 for a word and 0.78 for a sentence", () => {
    expect(WORD_RATE).toBe(0.88);
    expect(SENTENCE_RATE).toBe(0.78);
  });

  test("speaking cancels the utterance in progress, then speaks with the locale and the rate", () => {
    const { voice, events, utterances } = setup();
    voice.speak(request);
    expect(events).toEqual(["cancel", "speak"]);
    expect(utterances).toEqual([{ text: "lobo", lang: "es-ES", rate: 0.88 }]);
  });

  test("cancel cancels the synthesis", () => {
    const { voice, events } = setup();
    voice.cancel();
    expect(events).toEqual(["cancel"]);
  });

  test("without Web Speech nothing happens and nothing throws", () => {
    const voice = createSystemVoice({
      synthesis: () => undefined,
      createUtterance: () => {
        throw new Error("not available");
      },
    });
    expect(() => voice.speak(request)).not.toThrow();
    expect(() => voice.cancel()).not.toThrow();
  });

  test("a throwing synthesis is swallowed", () => {
    const voice = createSystemVoice({
      synthesis: () => {
        throw new Error("blocked");
      },
      createUtterance: (text) => ({ text }) as unknown as SpeechSynthesisUtterance,
    });
    expect(() => voice.speak(request)).not.toThrow();
    expect(() => voice.cancel()).not.toThrow();
  });
});
