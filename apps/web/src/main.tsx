import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppStore } from "./app/store";
import { AppProvider } from "./app/use-app";
import { AppShell } from "./shell/app-shell";
import { createRepository } from "./storage/create-repository";

async function start() {
  const container = document.getElementById("root");
  if (!container) {
    return;
  }
  const store = await AppStore.open(await createRepository());
  createRoot(container).render(
    <StrictMode>
      <AppProvider store={store}>
        <AppShell />
      </AppProvider>
    </StrictMode>,
  );
}

start();
