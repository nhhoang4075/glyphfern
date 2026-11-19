import type { PulledBook } from "./types";

export interface LocalBookRef {
  id: string;
  addedAt: number;
}

export interface BookPlan {
  download: PulledBook[];
  removeLocal: string[];
}

export function planBooks(
  remote: readonly PulledBook[],
  local: readonly LocalBookRef[],
  locallyDeletedIds: ReadonlySet<string>,
): BookPlan {
  const latest = new Map<string, PulledBook>();
  for (const meta of remote) {
    const current = latest.get(meta.id);
    if (!current || meta.seq >= current.seq) {
      latest.set(meta.id, meta);
    }
  }
  const download: PulledBook[] = [];
  const removeLocal: string[] = [];
  for (const meta of latest.values()) {
    const stored = local.find((book) => book.id === meta.id);
    if (meta.deleted) {
      if (stored && stored.addedAt <= meta.addedAt) {
        removeLocal.push(meta.id);
      }
    } else if (!stored && !locallyDeletedIds.has(meta.id)) {
      download.push(meta);
    }
  }
  return { download, removeLocal };
}
