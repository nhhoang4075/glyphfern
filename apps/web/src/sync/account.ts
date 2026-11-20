import type { Repository } from "../storage/repository";
import { syncOnce } from "./engine";
import { type Fetcher, HttpError, createSyncApi, failIfNotOk } from "./http";
import { SyncRunner, type SyncStatus } from "./runner";
import {
  type Session,
  type SessionStorage,
  type SessionUser,
  clearSession,
  readSession,
  writeSession,
} from "./session";

export type SignInError = "not_allowed" | "invalid_credential" | "unavailable";

export interface AccountState {
  googleClientId: string | null | undefined;
  configFailed: boolean;
  session: Session | null;
  status: SyncStatus;
  signInError: SignInError | null;
}

export interface TriggerTargets {
  onVisible(handler: () => void): () => void;
  onOnline(handler: () => void): () => void;
}

export interface AccountOptions {
  baseUrl: string | undefined;
  repository: Repository;
  reload: () => Promise<void>;
  fetcher?: Fetcher;
  storage?: SessionStorage | null;
  triggers?: TriggerTargets;
  now?: () => number;
  debounceMs?: number;
}

type Listener = () => void;

export function browserTriggers(): TriggerTargets {
  return {
    onVisible(handler) {
      const listener = () => {
        if (document.visibilityState === "visible") {
          handler();
        }
      };
      document.addEventListener("visibilitychange", listener);
      return () => document.removeEventListener("visibilitychange", listener);
    },
    onOnline(handler) {
      window.addEventListener("online", handler);
      return () => window.removeEventListener("online", handler);
    },
  };
}

export class AccountController {
  private state: AccountState;
  private readonly listeners = new Set<Listener>();
  private readonly fetcher: Fetcher;
  private runner: SyncRunner | null = null;
  private detachTriggers: Array<() => void> = [];
  private detachOutbox: (() => void) | null = null;
  private configLoaded = false;

  constructor(private readonly options: AccountOptions) {
    this.fetcher = options.fetcher ?? ((url, init) => fetch(url, init));
    this.state = {
      googleClientId: options.baseUrl ? undefined : null,
      configFailed: false,
      session: options.baseUrl ? readSession(this.storage()) : null,
      status: "idle",
      signInError: null,
    };
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): AccountState => this.state;

  async start(): Promise<void> {
    if (!this.options.baseUrl) {
      return;
    }
    const triggers = this.options.triggers;
    if (triggers) {
      this.detachTriggers.push(
        triggers.onVisible(() => this.onResume()),
        triggers.onOnline(() => this.onResume()),
      );
    }
    await Promise.all([this.loadConfig(), this.validateSession()]);
  }

  stop(): void {
    for (const off of this.detachTriggers) {
      off();
    }
    this.detachTriggers = [];
    this.endSession();
  }

  async signIn(credential: string): Promise<void> {
    const baseUrl = this.options.baseUrl;
    if (!baseUrl) {
      return;
    }
    try {
      const response = await this.fetcher(`${baseUrl}/auth/google`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ credential }),
      });
      await failIfNotOk(response);
      const body = (await response.json()) as Session;
      const session: Session = { token: body.token, user: body.user, expiresAt: body.expiresAt };
      writeSession(session, this.storage());
      this.set({ session, signInError: null });
      this.beginSession(session);
    } catch (error) {
      this.set({ signInError: signInErrorOf(error) });
    }
  }

  async signOut(): Promise<void> {
    const baseUrl = this.options.baseUrl;
    const session = this.state.session;
    this.expire();
    if (baseUrl && session) {
      try {
        await this.fetcher(`${baseUrl}/auth/logout`, {
          method: "POST",
          headers: { authorization: `Bearer ${session.token}` },
        });
      } catch {
        return;
      }
    }
  }

  private storage(): SessionStorage | null | undefined {
    return this.options.storage;
  }

  private set(change: Partial<AccountState>) {
    this.state = { ...this.state, ...change };
    for (const listener of this.listeners) {
      listener();
    }
  }

  private async loadConfig(): Promise<void> {
    if (this.configLoaded || !this.options.baseUrl) {
      return;
    }
    try {
      const response = await failIfNotOk(await this.fetcher(`${this.options.baseUrl}/auth/config`));
      const body = (await response.json()) as { googleClientId?: unknown };
      this.configLoaded = true;
      this.set({
        googleClientId: typeof body.googleClientId === "string" ? body.googleClientId : null,
        configFailed: false,
      });
    } catch {
      this.set({ configFailed: true });
    }
  }

  async retryConfig(): Promise<void> {
    this.set({ configFailed: false });
    await this.loadConfig();
  }

  private async validateSession(): Promise<void> {
    const session = this.state.session;
    const baseUrl = this.options.baseUrl;
    if (!session || !baseUrl) {
      return;
    }
    try {
      const response = await failIfNotOk(
        await this.fetcher(`${baseUrl}/auth/me`, {
          headers: { authorization: `Bearer ${session.token}` },
        }),
      );
      const body = (await response.json()) as { user?: SessionUser };
      const refreshed: Session = body.user ? { ...session, user: body.user } : session;
      writeSession(refreshed, this.storage());
      this.set({ session: refreshed });
      this.beginSession(refreshed);
    } catch (error) {
      if (error instanceof HttpError && error.status === 401) {
        this.expire();
        return;
      }
      this.beginSession(session);
    }
  }

  private beginSession(session: Session) {
    this.endSession();
    const baseUrl = this.options.baseUrl as string;
    const api = createSyncApi(baseUrl, session.token, this.fetcher);
    const now = this.options.now ?? Date.now;
    const runner = new SyncRunner({
      run: () =>
        syncOnce({ repository: this.options.repository, api, email: session.user.email, now }),
      onChanged: () => this.options.reload(),
      onUnauthorized: () => this.expire(),
      onStatus: (status) => this.set({ status }),
      debounceMs: this.options.debounceMs,
    });
    this.runner = runner;
    this.detachOutbox = this.options.repository.subscribeOutbox(() => runner.schedule());
    void runner.trigger();
  }

  private onResume() {
    void this.loadConfig();
    void this.runner?.trigger();
  }

  private expire() {
    clearSession(this.storage());
    this.endSession();
    this.set({ session: null, status: "idle" });
  }

  private endSession() {
    this.runner?.dispose();
    this.runner = null;
    this.detachOutbox?.();
    this.detachOutbox = null;
  }
}

function signInErrorOf(error: unknown): SignInError {
  if (error instanceof HttpError) {
    if (error.status === 403) {
      return "not_allowed";
    }
    if (error.status === 401) {
      return "invalid_credential";
    }
  }
  return "unavailable";
}
