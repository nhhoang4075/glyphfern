import type { VoiceKind } from "../app/api";
import type { Tts } from "./tts";

export type TtsRegistry = Record<VoiceKind, Tts>;

export function createTtsRegistry(system: Tts, server: Tts): TtsRegistry {
  const adapters: TtsRegistry = { system, server };
  const everyAdapter = Object.values(adapters);

  function select(kind: VoiceKind): Tts {
    const others = everyAdapter.filter((adapter) => adapter !== adapters[kind]);
    return {
      speak(request) {
        for (const other of others) {
          other.cancel();
        }
        adapters[kind].speak(request);
      },
      cancel() {
        for (const adapter of everyAdapter) {
          adapter.cancel();
        }
      },
    };
  }

  return { system: select("system"), server: select("server") };
}
