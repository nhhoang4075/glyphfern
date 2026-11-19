import { easeInOutQuad } from "./easing";

export type Clock = {
  now(): number;
  request(callback: (time: number) => void): number;
  cancel(id: number): void;
};

export const browserClock: Clock = {
  now: () => performance.now(),
  request: (callback) => requestAnimationFrame(callback),
  cancel: (id) => cancelAnimationFrame(id),
};

export type TweenOptions = {
  from: number;
  to: number;
  ms: number;
  ease?: (k: number) => number;
  onFrame: (value: number) => void;
  onDone: () => void;
  onError: (error: unknown) => void;
  clock?: Clock | undefined;
};

export function runTween(options: TweenOptions): () => void {
  const { from, to, ms, onFrame, onDone, onError } = options;
  const ease = options.ease ?? easeInOutQuad;
  const clock = options.clock ?? browserClock;
  let handle = 0;
  let stopped = false;

  function stop(): void {
    stopped = true;
    clock.cancel(handle);
  }

  if (ms <= 0) {
    try {
      onFrame(to);
    } catch (error) {
      stopped = true;
      onError(error);
      return stop;
    }
    stopped = true;
    onDone();
    return stop;
  }

  const start = clock.now();

  function frame(time: number): void {
    if (stopped) return;
    const k = Math.min(1, Math.max(0, (time - start) / ms));
    try {
      onFrame(from + (to - from) * ease(k));
    } catch (error) {
      stopped = true;
      onError(error);
      return;
    }
    if (k < 1) {
      handle = clock.request(frame);
      return;
    }
    stopped = true;
    onDone();
  }

  handle = clock.request(frame);
  return stop;
}
