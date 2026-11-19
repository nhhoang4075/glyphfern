import { createMemorySyncStore } from "./memory-sync-store";
import { describeSyncStore } from "./store-contract";

describeSyncStore("in-memory sync store", async () => ({
  store: createMemorySyncStore(),
  newUser: async () => crypto.randomUUID(),
}));
