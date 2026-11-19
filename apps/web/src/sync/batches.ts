import type { SyncRecord } from "./types";

export const MAX_BATCH_RECORDS = 500;
export const MAX_BATCH_BYTES = 1024 * 1024;
const ENVELOPE_BYTES = 32;

const encoder = new TextEncoder();

export function splitBatches(
  records: readonly SyncRecord[],
  maxRecords: number = MAX_BATCH_RECORDS,
  maxBytes: number = MAX_BATCH_BYTES,
): SyncRecord[][] {
  const batches: SyncRecord[][] = [];
  let current: SyncRecord[] = [];
  let bytes = ENVELOPE_BYTES;
  for (const record of records) {
    const size = encoder.encode(JSON.stringify(record)).byteLength + 1;
    if (current.length > 0 && (current.length >= maxRecords || bytes + size > maxBytes)) {
      batches.push(current);
      current = [];
      bytes = ENVELOPE_BYTES;
    }
    current.push(record);
    bytes += size;
  }
  if (current.length > 0) {
    batches.push(current);
  }
  return batches;
}
