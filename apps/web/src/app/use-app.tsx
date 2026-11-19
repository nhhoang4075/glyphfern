import { type ReactNode, createContext, useContext, useEffect, useSyncExternalStore } from "react";
import type { AppApi } from "./api";
import { applyLanguageToDocument, applyPreferencesToDocument } from "./document-effects";
import type { AppStore } from "./store";

const StoreContext = createContext<AppStore | null>(null);

export function AppProvider({ store, children }: { store: AppStore; children: ReactNode }) {
  const api = useSyncExternalStore(store.subscribe, store.getApi);

  useEffect(() => store.attachRouting(window), [store]);

  useEffect(() => {
    applyPreferencesToDocument(document.documentElement, api.state.preferences);
  }, [api.state.preferences]);

  useEffect(() => {
    applyLanguageToDocument(document.documentElement, api.state.lang);
  }, [api.state.lang]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useApp(): AppApi {
  const store = useContext(StoreContext);
  if (!store) {
    throw new Error("useApp must be used inside AppProvider");
  }
  return useSyncExternalStore(store.subscribe, store.getApi);
}
