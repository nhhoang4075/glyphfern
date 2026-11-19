import type { SyncOutcome } from "./engine";
import { HttpError } from "./http";

export type SyncStatus = "idle" | "syncing" | "synced" | "failed";

export interface RunnerOptions {
  run: () => Promise<SyncOutcome>;
  onChanged: () => Promise<void>;
  onUnauthorized: () => void;
  onStatus: (status: SyncStatus) => void;
  debounceMs?: number | undefined;
  setTimer?: (task: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export const SYNC_DEBOUNCE_MS = 2000;

export class SyncRunner {
  private running: Promise<void> | null = null;
  private again = false;
  private timer: unknown = null;
  private disposed = false;

  constructor(private readonly options: RunnerOptions) {}

  schedule(): void {
    if (this.disposed) {
      return;
    }
    this.cancelTimer();
    const setTimer = this.options.setTimer ?? ((task, ms) => setTimeout(task, ms));
    this.timer = setTimer(() => {
      this.timer = null;
      void this.trigger();
    }, this.options.debounceMs ?? SYNC_DEBOUNCE_MS);
  }

  trigger(): Promise<void> {
    if (this.disposed) {
      return Promise.resolve();
    }
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = this.loop().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  dispose(): void {
    this.disposed = true;
    this.cancelTimer();
  }

  private cancelTimer() {
    if (this.timer !== null) {
      const clearTimer = this.options.clearTimer ?? ((handle) => clearTimeout(handle as never));
      clearTimer(this.timer);
      this.timer = null;
    }
  }

  private async loop(): Promise<void> {
    do {
      this.again = false;
      await this.once();
    } while (this.again && !this.disposed);
  }

  private async once(): Promise<void> {
    this.options.onStatus("syncing");
    try {
      const outcome = await this.options.run();
      if (outcome.changed) {
        await this.options.onChanged();
      }
      this.options.onStatus(outcome.failed ? "failed" : "synced");
    } catch (error) {
      if (error instanceof HttpError && error.status === 401) {
        this.options.onUnauthorized();
        return;
      }
      this.options.onStatus("failed");
    }
  }
}
