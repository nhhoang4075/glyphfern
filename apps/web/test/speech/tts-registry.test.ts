import { describe, expect, test } from "bun:test";
import type { Tts } from "../../src/speech/tts";
import { createTtsRegistry } from "../../src/speech/tts-registry";

const request = { text: "lobo", lang: "es", locale: "es-ES", rate: 0.88 };

function recorder(name: string, log: string[]): Tts {
  return {
    speak: (next) => log.push(`${name}.speak:${next.text}`),
    cancel: () => log.push(`${name}.cancel`),
  };
}

describe("tts registry", () => {
  test("the system entry speaks through the system adapter after cancelling the server one", () => {
    const log: string[] = [];
    const registry = createTtsRegistry(recorder("system", log), recorder("server", log));
    registry.system.speak(request);
    expect(log).toEqual(["server.cancel", "system.speak:lobo"]);
  });

  test("the server entry speaks through the server adapter after cancelling the system one", () => {
    const log: string[] = [];
    const registry = createTtsRegistry(recorder("system", log), recorder("server", log));
    registry.server.speak(request);
    expect(log).toEqual(["system.cancel", "server.speak:lobo"]);
  });

  test("cancel stops both adapters", () => {
    const log: string[] = [];
    const registry = createTtsRegistry(recorder("system", log), recorder("server", log));
    registry.server.cancel();
    expect(log).toEqual(["system.cancel", "server.cancel"]);
  });

  test("entries are stable objects", () => {
    const log: string[] = [];
    const registry = createTtsRegistry(recorder("system", log), recorder("server", log));
    expect(registry.system).toBe(registry.system);
    expect(registry.system).not.toBe(registry.server);
  });
});
