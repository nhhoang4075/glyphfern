import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppStore } from "./app/store";
import { AppProvider } from "./app/useApp";
import { AppShell } from "./shell/AppShell";
import { createRepository } from "./storage/createRepository";

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
