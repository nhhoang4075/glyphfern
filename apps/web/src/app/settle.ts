export interface SettleTimers {
  set(callback: () => void, delayMs: number): number;
  clear(handle: number): void;
}

export interface SettleOptions {
  delayMs: number;
  onUnsettled?: () => void;
  onSettled: () => void;
  timers?: SettleTimers;
}

export interface Settler {
  touch(): void;
  cancel(): void;
  pending(): boolean;
}

const WINDOW_TIMERS: SettleTimers = {
  set: (callback, delayMs) => window.setTimeout(callback, delayMs),
  clear: (handle) => window.clearTimeout(handle),
};

export function createSettler({
  delayMs,
  onUnsettled = () => {},
  onSettled,
  timers = WINDOW_TIMERS,
}: SettleOptions): Settler {
  let handle: number | null = null;

  function touch(): void {
    if (handle === null) onUnsettled();
    else timers.clear(handle);
    handle = timers.set(() => {
      handle = null;
      onSettled();
    }, delayMs);
  }

  function cancel(): void {
    if (handle === null) return;
    timers.clear(handle);
    handle = null;
  }

  return { touch, cancel, pending: () => handle !== null };
}
