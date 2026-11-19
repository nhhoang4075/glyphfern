export const GOOGLE_SCRIPT_URL = "https://accounts.google.com/gsi/client";

export interface GoogleCredentialResponse {
  credential?: string;
}

export interface GoogleIdentity {
  accounts: {
    id: {
      initialize(options: {
        client_id: string;
        callback: (response: GoogleCredentialResponse) => void;
        auto_select?: boolean;
      }): void;
      renderButton(host: HTMLElement, options: Record<string, string | number>): void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

let loading: Promise<GoogleIdentity | null> | null = null;

export function loadGoogleIdentity(): Promise<GoogleIdentity | null> {
  loading ??= new Promise((resolve) => {
    if (window.google?.accounts?.id) {
      resolve(window.google);
      return;
    }
    const script = document.createElement("script");
    script.src = GOOGLE_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve(window.google?.accounts?.id ? window.google : null);
    script.onerror = () => {
      loading = null;
      script.remove();
      resolve(null);
    };
    document.head.append(script);
  });
  return loading;
}
