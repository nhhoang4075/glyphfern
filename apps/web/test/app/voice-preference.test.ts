import { describe, expect, test } from "bun:test";
import { defaultPreferences } from "../../src/app/defaults";
import { AppStore } from "../../src/app/store";
import { MemoryRepository } from "../../src/storage/memory-repository";
import { openTestRepository } from "../../src/test-support";

const options = { prefersReducedMotion: false, initialRoute: "read" as const };

describe("voice preference", () => {
  test("the default is the system voice", async () => {
    expect(defaultPreferences(false).voice).toBe("system");
    const store = await AppStore.open(new MemoryRepository(), options);
    expect(store.getApi().state.preferences.voice).toBe("system");
  });

  test("choosing the server voice persists on the memory repository", async () => {
    const repository = new MemoryRepository();
    const store = await AppStore.open(repository, options);
    store.actions.setPreference("voice", "server");
    await store.settled();
    expect(store.getApi().state.preferences.voice).toBe("server");
    expect((await repository.loadPreferences())?.voice).toBe("server");
    const reopened = await AppStore.open(repository, options);
    expect(reopened.getApi().state.preferences.voice).toBe("server");
  });

  test("choosing the server voice persists on the Dexie repository", async () => {
    const { name, repository } = await openTestRepository();
    const store = await AppStore.open(repository, options);
    store.actions.setPreference("voice", "server");
    await store.settled();
    const reopened = await AppStore.open((await openTestRepository(name)).repository, options);
    expect(reopened.getApi().state.preferences.voice).toBe("server");
  });

  test("preferences stored without a voice load as the system voice", async () => {
    const repository = new MemoryRepository();
    const { voice: _omitted, ...legacy } = defaultPreferences(false);
    await repository.savePreferences({ ...legacy, size: 25 } as never);
    const store = await AppStore.open(repository, options);
    expect(store.getApi().state.preferences.voice).toBe("system");
    expect(store.getApi().state.preferences.size).toBe(25);
  });

  test("stored preferences without a voice on Dexie load as the system voice", async () => {
    const { name, repository } = await openTestRepository();
    const { voice: _omitted, ...legacy } = defaultPreferences(false);
    await repository.savePreferences({ ...legacy, size: 26 } as never);
    const store = await AppStore.open((await openTestRepository(name)).repository, options);
    expect(store.getApi().state.preferences.voice).toBe("system");
    expect(store.getApi().state.preferences.size).toBe(26);
  });
});
