import type { OutboxEntry, SyncRecord } from "./types";

export type MergeWinner = "local" | "remote";

export function mergeRecord(
  local: Pick<OutboxEntry, "updatedAt"> | undefined,
  remote: Pick<SyncRecord, "kind" | "updatedAt">,
): MergeWinner {
  if (!local) {
    return "remote";
  }
  if (remote.kind === "review") {
    return "local";
  }
  return remote.updatedAt >= local.updatedAt ? "remote" : "local";
}

export function latestPerKey(entries: readonly OutboxEntry[]): OutboxEntry[] {
  const chosen = new Map<string, OutboxEntry>();
  for (const entry of entries) {
    const id = `${entry.kind}\u0000${entry.key}`;
    const current = chosen.get(id);
    if (!current) {
      chosen.set(id, entry);
    } else if (entry.kind !== "review" && entry.updatedAt >= current.updatedAt) {
      chosen.set(id, entry);
    }
  }
  return [...chosen.values()];
}

export function toRecord(entry: OutboxEntry): SyncRecord {
  return {
    kind: entry.kind as SyncRecord["kind"],
    key: entry.key,
    payload: entry.payload,
    updatedAt: entry.updatedAt,
    deleted: entry.deleted,
  };
}
