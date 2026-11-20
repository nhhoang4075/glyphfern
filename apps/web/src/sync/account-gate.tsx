import type { ReactNode } from "react";
import { Fern } from "../icons/icon";
import { Button } from "../ui";
import { SIGN_IN_ERROR_TEXT } from "./account-row";
import { decideGate, gateConfigOf } from "./gate";
import { GoogleButton } from "./google-button";
import { useAccount } from "./sync-provider";

export function AccountGate({ children }: { children: ReactNode }) {
  const { state, controller } = useAccount();
  const view = decideGate({
    hasSession: state.session !== null,
    config: gateConfigOf(state),
  });

  if (view === "app") {
    return <>{children}</>;
  }
  if (view === "loading") {
    return <div className="gate" aria-busy="true" />;
  }
  return (
    <main className="gate">
      <Fern className="gate-mark" />
      <h1 className="gate-title">Glyphfern</h1>
      {view === "gate" && state.googleClientId ? (
        <>
          <GoogleButton
            clientId={state.googleClientId}
            onCredential={(c) => void controller.signIn(c)}
          />
          {state.signInError ? (
            <output className="gate-error">{SIGN_IN_ERROR_TEXT[state.signInError]}</output>
          ) : null}
        </>
      ) : (
        <>
          <p className="gate-text">Cần kết nối mạng để đăng nhập lần đầu.</p>
          <Button className="gate-retry" onClick={() => void controller.retryConfig()}>
            Thử lại
          </Button>
        </>
      )}
    </main>
  );
}
