import { gunzipSync, gzipSync, strFromU8, strToU8 } from "fflate";
import type { StoredBook } from "../storage/repository";

export function packBook(stored: StoredBook): Uint8Array {
  return gzipSync(strToU8(JSON.stringify(stored)));
}

export function unpackBook(bytes: Uint8Array): StoredBook | null {
  try {
    const parsed = JSON.parse(strFromU8(gunzipSync(bytes))) as StoredBook;
    return typeof parsed.id === "string" && typeof parsed.seq === "number" && parsed.book
      ? parsed
      : null;
  } catch {
    return null;
  }
}
