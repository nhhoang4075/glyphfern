import { describe, expect, test } from "bun:test";
import {
  type AudioLike,
  type TtsFetcher,
  type TtsResponse,
  createServerVoice,
} from "../../src/speech/server-voice";
import type { SpeechRequest, Tts } from "../../src/speech/tts";

const request: SpeechRequest = {
  text: "¿Dónde está la niña?",
  lang: "es",
  locale: "es-ES",
  rate: 0.78,
};

class FakeAudio implements AudioLike {
  src = "";
  onended: ((event: Event) => void) | null = null;
  onerror: ((event: Event | string) => void) | null = null;
  playedSources: string[] = [];
  pauses = 0;
  rejectPlay = false;

  play(): Promise<void> {
    if (this.rejectPlay) {
      return Promise.reject(new Error("blocked"));
    }
    this.playedSources.push(this.src);
    return Promise.resolve();
  }

  pause() {
    this.pauses += 1;
  }
}

class FakeFallback implements Tts {
  spoken: SpeechRequest[] = [];

  speak(next: SpeechRequest) {
    this.spoken.push(next);
  }

  cancel() {}
}

function okResponse(label: string): TtsResponse {
  return { status: 200, blob: async () => new Blob([label], { type: "audio/mpeg" }) };
}

function statusResponse(status: number): TtsResponse {
  return { status, blob: async () => new Blob([]) };
}

interface Deferred {
  promise: Promise<TtsResponse>;
  resolve: (response: TtsResponse) => void;
}

function deferred(): Deferred {
  let resolve: (response: TtsResponse) => void = () => {};
  const promise = new Promise<TtsResponse>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

interface SetupOptions {
  respond?: TtsFetcher;
  baseUrl?: string | undefined;
  waitMs?: number;
}

function setup(options: SetupOptions = {}) {
  const audio = new FakeAudio();
  const fallback = new FakeFallback();
  const calls: { url: string; signal: AbortSignal }[] = [];
  const created: string[] = [];
  const revoked: string[] = [];
  let audioCreations = 0;
  const respond: TtsFetcher = options.respond ?? (async () => okResponse("clip"));
  const voice = createServerVoice({
    baseUrl: "baseUrl" in options ? options.baseUrl : "http://api.test",
    fetcher: async (url, init) => {
      calls.push({ url, signal: init.signal });
      return respond(url, init);
    },
    createAudio: () => {
      audioCreations += 1;
      return audio;
    },
    fallback,
    ...(options.waitMs === undefined ? {} : { waitMs: options.waitMs }),
    objectUrls: {
      create: () => {
        const url = `blob:clip-${created.length + 1}`;
        created.push(url);
        return url;
      },
      revoke: (url) => {
        revoked.push(url);
      },
    },
  });
  return { voice, audio, fallback, calls, created, revoked, audioCreations: () => audioCreations };
}

async function flush() {
  for (let turn = 0; turn < 10; turn += 1) {
    await Promise.resolve();
  }
}

describe("server voice request", () => {
  test("asks GET /tts with the lang code, the encoded text and the unchanged speed", async () => {
    const { voice, calls } = setup();
    voice.speak(request);
    await flush();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(
      `http://api.test/tts?lang=es&text=${encodeURIComponent(request.text)}&speed=0.78`,
    );
  });

  test("sends the word rate unchanged", async () => {
    const { voice, calls } = setup();
    voice.speak({ ...request, text: "lobo", rate: 0.88 });
    await flush();
    expect(calls[0]?.url).toBe("http://api.test/tts?lang=es&text=lobo&speed=0.88");
  });

  test("a 200 response is played from an object URL of the blob and the fallback stays silent", async () => {
    const { voice, audio, fallback, created } = setup();
    voice.speak(request);
    await flush();
    expect(created).toEqual(["blob:clip-1"]);
    expect(audio.playedSources).toEqual(["blob:clip-1"]);
    expect(fallback.spoken).toEqual([]);
  });

  test("the object URL is revoked when playback ends", async () => {
    const { voice, audio, revoked } = setup();
    voice.speak(request);
    await flush();
    expect(revoked).toEqual([]);
    audio.onended?.(new Event("ended"));
    expect(revoked).toEqual(["blob:clip-1"]);
  });

  test("one audio element is created synchronously inside the first speak and reused", async () => {
    const { voice, audioCreations } = setup();
    voice.speak(request);
    expect(audioCreations()).toBe(1);
    await flush();
    voice.speak(request);
    await flush();
    expect(audioCreations()).toBe(1);
  });
});

describe("server voice fallback", () => {
  for (const status of [404, 429, 502, 503]) {
    test(`status ${status} speaks the same request through the fallback once and plays nothing`, async () => {
      const { voice, audio, fallback } = setup({ respond: async () => statusResponse(status) });
      voice.speak(request);
      await flush();
      expect(fallback.spoken).toEqual([request]);
      expect(audio.playedSources).toEqual([]);
    });
  }

  test("a thrown network error speaks through the fallback once", async () => {
    const { voice, audio, fallback } = setup({
      respond: async () => {
        throw new TypeError("network down");
      },
    });
    voice.speak(request);
    await flush();
    expect(fallback.spoken).toEqual([request]);
    expect(audio.playedSources).toEqual([]);
  });

  test("a successful status other than 200 still falls back", async () => {
    const { voice, fallback } = setup({ respond: async () => statusResponse(204) });
    voice.speak(request);
    await flush();
    expect(fallback.spoken).toEqual([request]);
  });

  test("no base URL goes straight to the fallback without a request", async () => {
    const { voice, fallback, calls } = setup({ baseUrl: undefined });
    voice.speak(request);
    await flush();
    expect(fallback.spoken).toEqual([request]);
    expect(calls).toEqual([]);
  });

  test("a rejected play falls back and revokes the object URL", async () => {
    const { voice, audio, fallback, revoked } = setup();
    audio.rejectPlay = true;
    voice.speak(request);
    await flush();
    expect(fallback.spoken).toEqual([request]);
    expect(revoked).toEqual(["blob:clip-1"]);
  });

  test("a playback error event falls back once", async () => {
    const { voice, audio, fallback } = setup();
    voice.speak(request);
    await flush();
    audio.onerror?.(new Event("error"));
    audio.onerror?.(new Event("error"));
    expect(fallback.spoken).toEqual([request]);
  });
});

describe("server voice cancellation", () => {
  test("a second speak aborts the first and the late first response never plays", async () => {
    const first = deferred();
    const second = deferred();
    const pending = [first, second];
    const { voice, audio, fallback, calls } = setup({
      respond: async () => {
        const next = pending.shift();
        if (!next) throw new Error("unexpected request");
        return next.promise;
      },
    });
    voice.speak({ ...request, text: "uno" });
    voice.speak({ ...request, text: "dos" });
    expect(calls[0]?.signal.aborted).toBe(true);
    expect(calls[1]?.signal.aborted).toBe(false);
    second.resolve(okResponse("dos"));
    await flush();
    first.resolve(okResponse("uno"));
    await flush();
    expect(audio.playedSources).toEqual(["blob:clip-1"]);
    expect(fallback.spoken).toEqual([]);
  });

  test("speaking again pauses the clip in progress", async () => {
    const { voice, audio } = setup();
    voice.speak(request);
    await flush();
    const before = audio.pauses;
    voice.speak(request);
    expect(audio.pauses).toBe(before + 1);
  });

  test("cancel stops playback, aborts the request and revokes the URL", async () => {
    const { voice, audio, calls, revoked } = setup();
    voice.speak(request);
    await flush();
    voice.cancel();
    expect(audio.pauses).toBe(1);
    expect(calls[0]?.signal.aborted).toBe(true);
    expect(revoked).toEqual(["blob:clip-1"]);
  });

  test("cancel before the response arrives: the response never plays and the fallback stays silent", async () => {
    const pending = deferred();
    const { voice, audio, fallback } = setup({ respond: async () => pending.promise });
    voice.speak(request);
    voice.cancel();
    pending.resolve(okResponse("late"));
    await flush();
    expect(audio.playedSources).toEqual([]);
    expect(fallback.spoken).toEqual([]);
  });

  test("an abort error that arrives after cancel does not reach the fallback", async () => {
    const { voice, fallback } = setup({
      respond: async (_url, init) => {
        await new Promise((resolve) => setTimeout(resolve, 0));
        if (init.signal.aborted) throw new DOMException("aborted", "AbortError");
        return okResponse("x");
      },
    });
    voice.speak(request);
    voice.cancel();
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(fallback.spoken).toEqual([]);
  });

  test("a server that takes too long hands the text to the fallback voice once", async () => {
    const pending = deferred();
    const { voice, fallback, calls } = setup({ respond: () => pending.promise, waitMs: 20 });
    voice.speak(request);
    await new Promise((done) => setTimeout(done, 60));
    expect(fallback.spoken).toEqual([request]);
    expect(calls[0]?.signal.aborted).toBe(true);
    pending.resolve(okResponse("late"));
    await new Promise((done) => setTimeout(done, 10));
    expect(fallback.spoken).toEqual([request]);
  });
});
