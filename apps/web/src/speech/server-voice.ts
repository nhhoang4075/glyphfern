import type { SpeechRequest, Tts } from "./tts";

export interface TtsResponse {
  status: number;
  blob(): Promise<Blob>;
}

export type TtsFetcher = (url: string, init: { signal: AbortSignal }) => Promise<TtsResponse>;

export interface AudioLike {
  src: string;
  onended: ((event: Event) => void) | null;
  onerror: ((event: Event | string) => void) | null;
  play(): Promise<void>;
  pause(): void;
}

export interface ObjectUrls {
  create(blob: Blob): string;
  revoke(url: string): void;
}

export interface ServerVoiceDependencies {
  baseUrl: string | undefined;
  fetcher: TtsFetcher;
  createAudio: () => AudioLike;
  fallback: Tts;
  objectUrls: ObjectUrls;
}

const STATUS_OK = 200;

export function ttsUrl(baseUrl: string, request: SpeechRequest): string {
  const lang = encodeURIComponent(request.lang);
  const text = encodeURIComponent(request.text);
  return `${baseUrl}/tts?lang=${lang}&text=${text}&speed=${request.rate}`;
}

export function createServerVoice(dependencies: ServerVoiceDependencies): Tts {
  const { baseUrl, fetcher, createAudio, fallback, objectUrls } = dependencies;
  let audio: AudioLike | null = null;
  let inFlight: AbortController | null = null;
  let objectUrl: string | null = null;

  function releaseUrl() {
    if (objectUrl !== null) {
      objectUrls.revoke(objectUrl);
      objectUrl = null;
    }
  }

  function stop() {
    inFlight?.abort();
    inFlight = null;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
    }
    releaseUrl();
  }

  async function run(
    url: string,
    request: SpeechRequest,
    controller: AbortController,
    element: AudioLike,
  ) {
    const failOver = () => {
      if (controller.signal.aborted) {
        return;
      }
      controller.abort();
      releaseUrl();
      fallback.speak(request);
    };
    try {
      const response = await fetcher(url, { signal: controller.signal });
      if (controller.signal.aborted) {
        return;
      }
      if (response.status !== STATUS_OK) {
        failOver();
        return;
      }
      const blob = await response.blob();
      if (controller.signal.aborted) {
        return;
      }
      objectUrl = objectUrls.create(blob);
      element.onended = releaseUrl;
      element.onerror = failOver;
      element.src = objectUrl;
      await element.play();
    } catch {
      failOver();
    }
  }

  return {
    speak(request) {
      stop();
      if (!baseUrl) {
        fallback.speak(request);
        return;
      }
      try {
        audio ??= createAudio();
      } catch {
        fallback.speak(request);
        return;
      }
      const controller = new AbortController();
      inFlight = controller;
      void run(ttsUrl(baseUrl, request), request, controller, audio);
    },
    cancel: stop,
  };
}

export function createBrowserServerVoice(baseUrl: string | undefined, fallback: Tts): Tts {
  return createServerVoice({
    baseUrl,
    fallback,
    fetcher: (url, init) => fetch(url, init),
    createAudio: () => new Audio(),
    objectUrls: {
      create: (blob) => URL.createObjectURL(blob),
      revoke: (url) => URL.revokeObjectURL(url),
    },
  });
}
