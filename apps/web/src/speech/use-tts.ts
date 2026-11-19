import { useApp } from "../app/use-app";
import { createBrowserServerVoice } from "./server-voice";
import { createSystemVoice } from "./system-voice";
import type { Tts } from "./tts";
import { createTtsRegistry } from "./tts-registry";

const systemVoice = createSystemVoice();

const registry = createTtsRegistry(
  systemVoice,
  createBrowserServerVoice(import.meta.env.VITE_API_URL, systemVoice),
);

export function useTts(): Tts {
  const { state } = useApp();
  return registry[state.preferences.voice];
}
