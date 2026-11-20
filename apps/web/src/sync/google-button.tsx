import { useEffect, useRef, useState } from "react";
import { loadGoogleIdentity } from "./google-identity";

export interface GoogleButtonProps {
  clientId: string;
  onCredential: (credential: string) => void;
}

function useNightMode(): boolean {
  const [night, setNight] = useState(() => document.documentElement.hasAttribute("data-night"));
  useEffect(() => {
    const observer = new MutationObserver(() =>
      setNight(document.documentElement.hasAttribute("data-night")),
    );
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-night"],
    });
    return () => observer.disconnect();
  }, []);
  return night;
}

export function GoogleButton({ clientId, onCredential }: GoogleButtonProps) {
  const host = useRef<HTMLDivElement>(null);
  const handler = useRef(onCredential);
  handler.current = onCredential;
  const [ready, setReady] = useState(false);
  const night = useNightMode();

  useEffect(() => {
    let cancelled = false;
    loadGoogleIdentity().then((google) => {
      if (cancelled || !google || !host.current) {
        return;
      }
      google.accounts.id.initialize({
        client_id: clientId,
        auto_select: false,
        callback: (response) => {
          if (response.credential) {
            handler.current(response.credential);
          }
        },
      });
      google.accounts.id.renderButton(host.current, {
        type: "standard",
        theme: night ? "filled_black" : "outline",
        size: "medium",
        text: "signin_with",
        shape: "pill",
      });
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [clientId, night]);

  return <div ref={host} className="account-google" data-ready={ready} hidden={!ready} />;
}
