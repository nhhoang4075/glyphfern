import { describe, expect, test } from "bun:test";
import { AppStore } from "../../src/app/store";
import { MemoryRepository } from "../../src/storage/memory-repository";

const options = { prefersReducedMotion: false, initialRoute: "read" as const };

describe("reload", () => {
  test("re-reads the repository so changes written behind the store show up", async () => {
    const repository = new MemoryRepository();
    const store = await AppStore.open(repository, options);
    await repository.saveWordState("es", "lobo", { kind: "known" });
    await repository.saveBookmarks("es", [4]);
    await repository.savePins(["user-1"]);
    expect(store.getApi().stateOf("lobo")).toEqual({ kind: "new" });
    await store.actions.reload();
    expect(store.getApi().stateOf("lobo")).toEqual({ kind: "known" });
    expect(store.getApi().state.bookmarks).toEqual([4]);
    expect(store.getApi().state.pins).toEqual(["user-1"]);
    expect(store.getApi().state.route).toBe("read");
  });

  test("keeps writes made by the store itself while it reloads", async () => {
    const repository = new MemoryRepository();
    const store = await AppStore.open(repository, options);
    store.actions.setWordState("casa", "known");
    await store.actions.reload();
    expect(store.getApi().stateOf("casa")).toEqual({ kind: "known" });
  });
});
