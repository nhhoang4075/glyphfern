import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { AppApi, Preferences } from "./api";
import {
  type LayoutPreferences,
  applyLanguageToDocument,
  applyLayoutToDocument,
  applyPreferencesToDocument,
  layoutKeyOf,
  layoutPreferencesOf,
} from "./document-effects";
import { createSettler } from "./settle";
import type { AppStore } from "./store";

export const LAYOUT_SETTLE_MS = 150;

const StoreContext = createContext<AppStore | null>(null);
const SettledLayoutKeyContext = createContext("");

function useSettledLayout(preferences: Preferences): LayoutPreferences {
  const latest = useRef(layoutPreferencesOf(preferences));
  latest.current = layoutPreferencesOf(preferences);
  const [settled, setSettled] = useState(latest.current);
  const key = layoutKeyOf(latest.current);

  const settler = useRef<ReturnType<typeof createSettler> | null>(null);
  if (settler.current === null) {
    settler.current = createSettler({
      delayMs: LAYOUT_SETTLE_MS,
      onSettled: () =>
        setSettled((previous) =>
          layoutKeyOf(previous) === layoutKeyOf(latest.current) ? previous : latest.current,
        ),
    });
  }

  useEffect(() => {
    if (key !== layoutKeyOf(settled)) settler.current?.touch();
  }, [key, settled]);

  useEffect(() => () => settler.current?.cancel(), []);

  return settled;
}

export function AppProvider({ store, children }: { store: AppStore; children: ReactNode }) {
  const api = useSyncExternalStore(store.subscribe, store.getApi);
  const layout = useSettledLayout(api.state.preferences);

  useEffect(() => store.attachRouting(window), [store]);

  useEffect(() => {
    applyPreferencesToDocument(document.documentElement, api.state.preferences);
  }, [api.state.preferences]);

  useEffect(() => {
    applyLayoutToDocument(document.documentElement, layout);
  }, [layout]);

  useEffect(() => {
    applyLanguageToDocument(document.documentElement, api.state.lang);
  }, [api.state.lang]);

  return (
    <StoreContext.Provider value={store}>
      <SettledLayoutKeyContext.Provider value={layoutKeyOf(layout)}>
        {children}
      </SettledLayoutKeyContext.Provider>
    </StoreContext.Provider>
  );
}

export function useSettledLayoutKey(): string {
  return useContext(SettledLayoutKeyContext);
}

export function useApp(): AppApi {
  const store = useContext(StoreContext);
  if (!store) {
    throw new Error("useApp must be used inside AppProvider");
  }
  return useSyncExternalStore(store.subscribe, store.getApi);
}
