import { useEffect, useRef, useState } from "react";
import { loadGoogleIdentity } from "./google-identity";

export interface GoogleButtonProps {
  clientId: string;
  onCredential: (credential: string) => void;
}

export function GoogleButton({ clientId, onCredential }: GoogleButtonProps) {
  const host = useRef<HTMLDivElement>(null);
  const handler = useRef(onCredential);
  handler.current = onCredential;
  const [ready, setReady] = useState(false);

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
        theme: "outline",
        size: "medium",
        text: "signin_with",
        shape: "pill",
      });
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  return <div ref={host} className="account-google" data-ready={ready} hidden={!ready} />;
}
