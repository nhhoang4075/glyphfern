import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { DexieRepository, GlyphfernDatabase } from "./storage/dexie-repository";

let counter = 0;

export function uniqueDatabaseName(): string {
  counter += 1;
  return `glyphfern-test-${counter}-${Math.random().toString(36).slice(2)}`;
}

export async function openTestRepository(
  name: string = uniqueDatabaseName(),
  now: () => number = Date.now,
) {
  const database = new GlyphfernDatabase(name, { indexedDB, IDBKeyRange });
  await database.open();
  return { name, database, repository: new DexieRepository(database, now) };
}
