import type { SyncApi } from "../../src/sync/http";
import { HttpError } from "../../src/sync/http";
import {
  type BookUploadMeta,
  type PullResponse,
  type PulledBook,
  type PulledRecord,
  RECORD_KINDS,
  type SyncRecord,
} from "../../src/sync/types";

interface StoredBlob {
  meta: PulledBook;
  data: Uint8Array | null;
}

export class FakeServer {
  private seq = 0;
  readonly records = new Map<string, PulledRecord>();
  readonly books = new Map<string, StoredBlob>();
  failNext: Error | null = null;
  pushCalls: number[] = [];

  api(): SyncApi {
    return {
      push: async (records) => {
        this.maybeFail();
        return this.push(records);
      },
      pull: async (since, limit) => {
        this.maybeFail();
        return this.pull(since, limit);
      },
      putBook: async (id, meta, gzipped) => {
        this.maybeFail();
        this.putBook(id, meta, gzipped);
      },
      getBook: async (id) => {
        this.maybeFail();
        return this.books.get(id)?.data ?? null;
      },
      deleteBook: async (id) => {
        this.maybeFail();
        this.deleteBook(id);
      },
    };
  }

  private maybeFail() {
    if (this.failNext) {
      const error = this.failNext;
      this.failNext = null;
      throw error;
    }
  }

  private push(records: readonly SyncRecord[]) {
    if (records.length > 500) {
      throw new HttpError(400, "invalid_record");
    }
    if (records.some((record) => !RECORD_KINDS.includes(record.kind) || !record.key)) {
      throw new HttpError(400, "invalid_record");
    }
    this.pushCalls.push(records.length);
    let accepted = 0;
    for (const record of records) {
      const id = `${record.kind}\u0000${record.key}`;
      const stored = this.records.get(id);
      if (stored && record.kind === "review") {
        continue;
      }
      if (stored && record.updatedAt <= stored.updatedAt) {
        continue;
      }
      this.seq += 1;
      this.records.set(id, {
        ...structuredClone(record),
        payload: record.deleted ? null : structuredClone(record.payload),
        seq: this.seq,
      });
      accepted += 1;
    }
    return { accepted, cursor: this.seq };
  }

  private pull(since: number, limit: number): PullResponse {
    const items: Array<{ seq: number; record?: PulledRecord; book?: PulledBook }> = [];
    for (const record of this.records.values()) {
      if (record.seq > since) {
        items.push({ seq: record.seq, record: structuredClone(record) });
      }
    }
    for (const { meta } of this.books.values()) {
      if (meta.seq > since) {
        items.push({ seq: meta.seq, book: { ...meta } });
      }
    }
    items.sort((a, b) => a.seq - b.seq);
    const page = items.slice(0, Math.min(limit, 500));
    return {
      records: page.flatMap((item) => (item.record ? [item.record] : [])),
      books: page.flatMap((item) => (item.book ? [item.book] : [])),
      cursor: page.length > 0 ? (page[page.length - 1]?.seq ?? since) : since,
      more: items.length > page.length,
    };
  }

  private putBook(id: string, meta: BookUploadMeta, data: Uint8Array) {
    this.seq += 1;
    this.books.set(id, {
      meta: {
        id,
        lang: meta.lang,
        title: meta.title,
        addedAt: meta.addedAt,
        seq: this.seq,
        deleted: false,
        bytes: data.byteLength,
      },
      data,
    });
  }

  private deleteBook(id: string) {
    const stored = this.books.get(id);
    this.seq += 1;
    this.books.set(id, {
      meta: {
        id,
        lang: stored?.meta.lang ?? "es",
        title: stored?.meta.title ?? "",
        addedAt: stored?.meta.addedAt ?? 0,
        seq: this.seq,
        deleted: true,
        bytes: 0,
      },
      data: null,
    });
  }
}
