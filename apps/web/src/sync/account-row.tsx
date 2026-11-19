import { Button } from "../ui";
import type { SignInError } from "./account";
import { GoogleButton } from "./google-button";
import type { SyncStatus } from "./runner";
import { useAccount } from "./sync-provider";

export const STATUS_TEXT: Record<SyncStatus, string> = {
  idle: "Đã đồng bộ",
  syncing: "Đang đồng bộ…",
  synced: "Đã đồng bộ",
  failed: "Chưa đồng bộ được",
};

export const SIGN_IN_ERROR_TEXT: Record<SignInError, string> = {
  not_allowed: "Email này chưa được phép đăng nhập.",
  invalid_credential: "Đăng nhập không thành công. Hãy thử lại.",
  unavailable: "Chưa kết nối được máy chủ. Hãy thử lại sau.",
};

export function AccountRow() {
  const { state, controller } = useAccount();
  const { session, googleClientId, status, signInError } = state;

  if (session) {
    return (
      <div className="account">
        {session.user.picture ? (
          <img
            className="account-avatar"
            src={session.user.picture}
            alt=""
            referrerPolicy="no-referrer"
          />
        ) : null}
        <span className="account-email">{session.user.email}</span>
        <output className="account-status" data-status={status}>
          {STATUS_TEXT[status]}
        </output>
        <Button className="account-out" onClick={() => void controller.signOut()}>
          Đăng xuất
        </Button>
      </div>
    );
  }

  if (!googleClientId) {
    return null;
  }

  return (
    <div className="account">
      <GoogleButton clientId={googleClientId} onCredential={(c) => void controller.signIn(c)} />
      {signInError ? (
        <output className="account-status">{SIGN_IN_ERROR_TEXT[signInError]}</output>
      ) : null}
    </div>
  );
}
