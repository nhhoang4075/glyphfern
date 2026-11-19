import { DexieRepository, GlyphfernDatabase } from "./dexie-repository";
import { MemoryRepository } from "./memory-repository";
import type { Repository } from "./repository";

export async function openDexieRepository(): Promise<Repository> {
  const database = new GlyphfernDatabase();
  await database.open();
  const repository = new DexieRepository(database);
  await repository.loadPins();
  return repository;
}

export async function createRepository(
  open: () => Promise<Repository> = openDexieRepository,
): Promise<Repository> {
  try {
    return await open();
  } catch {
    return new MemoryRepository();
  }
}
