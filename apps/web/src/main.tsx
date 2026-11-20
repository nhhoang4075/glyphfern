import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppStore } from "./app/store";
import { AppProvider } from "./app/use-app";
import { lexicon } from "./lexicon/lexicon-client";
import { AppShell } from "./shell/app-shell";
import { createRepository } from "./storage/create-repository";
import { AccountController, browserTriggers } from "./sync/account";
import { AccountGate } from "./sync/account-gate";
import { SyncProvider } from "./sync/sync-provider";

async function start() {
  const container = document.getElementById("root");
  if (!container) {
    return;
  }
  const repository = await createRepository();
  const store = await AppStore.open(repository, {
    lemmatizer: (lang, words) => lexicon.lemmatize(lang, words),
  });
  const account = new AccountController({
    baseUrl: import.meta.env.VITE_API_URL,
    repository,
    reload: () => store.actions.reload(),
    triggers: browserTriggers(),
  });
  createRoot(container).render(
    <StrictMode>
      <AppProvider store={store}>
        <SyncProvider controller={account}>
          <AccountGate>
            <AppShell />
          </AccountGate>
        </SyncProvider>
      </AppProvider>
    </StrictMode>,
  );
  void account.start();
}

start();
