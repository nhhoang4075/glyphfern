import { type ReactNode, createContext, useContext, useSyncExternalStore } from "react";
import type { AccountController, AccountState } from "./account";

const AccountContext = createContext<AccountController | null>(null);

export function SyncProvider({
  controller,
  children,
}: {
  controller: AccountController;
  children: ReactNode;
}) {
  return <AccountContext.Provider value={controller}>{children}</AccountContext.Provider>;
}

export function useAccount(): { state: AccountState; controller: AccountController } {
  const controller = useContext(AccountContext);
  if (!controller) {
    throw new Error("useAccount must be used inside SyncProvider");
  }
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  return { state, controller };
}
