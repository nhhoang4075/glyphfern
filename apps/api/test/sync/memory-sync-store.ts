import { type PushRecord, shouldReplace } from "../../src/sync/records";
import {
  MAX_BOOKS_PER_USER,
  MAX_BOOK_BYTES_PER_USER,
  type PulledBook,
  type PulledRecord,
  type SyncStore,
  mergePage,
} from "../../src/sync/sync-store";

interface StoredBook extends PulledBook {
  data: Uint8Array | null;
  lang: string;
}

export function createMemorySyncStore(): SyncStore {
  let sequence = 0;
  const records = new Map<string, PulledRecord>();
  const books = new Map<string, StoredBook>();
  const nextSeq = () => ++sequence;
  const slot = (userId: string, ...parts: string[]) => [userId, ...parts].join("\u0000");

  return {
    async push(userId, incoming: PushRecord[]) {
      let accepted = 0;
      for (const record of incoming) {
        const id = slot(userId, record.kind, record.key);
        const stored = records.get(id);
        const replace =
          record.kind === "review"
            ? stored === undefined
            : shouldReplace(stored?.updatedAt, record.updatedAt);
        if (replace) {
          records.set(id, {
            kind: record.kind,
            key: record.key,
            payload: record.payload,
            updatedAt: record.updatedAt,
            deleted: record.deleted,
            seq: nextSeq(),
          });
          accepted += 1;
        }
      }
      const owned = [...records.entries(), ...books.entries()]
        .filter(([id]) => id.startsWith(`${userId}\u0000`))
        .map(([, row]) => row.seq);
      return { accepted, cursor: Math.max(0, ...owned) };
    },

    async pull(userId, since, limit) {
      const prefix = `${userId}\u0000`;
      const ownedRecords = [...records.entries()]
        .filter(([id, row]) => id.startsWith(prefix) && row.seq > since)
        .map(([, row]) => row);
      const ownedBooks = [...books.entries()]
        .filter(([id, row]) => id.startsWith(prefix) && row.seq > since)
        .map(([, { data: _data, ...meta }]) => meta);
      return mergePage(ownedRecords, ownedBooks, since, limit);
    },

    async putBook(userId, book) {
      const prefix = `${userId}\u0000`;
      const others = [...books.entries()].filter(
        ([id, row]) => id.startsWith(prefix) && id !== slot(userId, book.id) && !row.deleted,
      );
      const total = others.reduce((sum, [, row]) => sum + row.bytes, 0);
      if (
        others.length + 1 > MAX_BOOKS_PER_USER ||
        total + book.data.length > MAX_BOOK_BYTES_PER_USER
      ) {
        return "quota_exceeded";
      }
      books.set(slot(userId, book.id), {
        id: book.id,
        lang: book.lang,
        title: book.title,
        addedAt: book.addedAt,
        deleted: false,
        bytes: book.data.length,
        seq: nextSeq(),
        data: new Uint8Array(book.data),
      });
      return "stored";
    },

    async getBook(userId, id) {
      const book = books.get(slot(userId, id));
      return book && !book.deleted && book.data ? new Uint8Array(book.data) : undefined;
    },

    async deleteBook(userId, id) {
      const stored = books.get(slot(userId, id));
      books.set(slot(userId, id), {
        id,
        lang: stored?.lang ?? "es",
        title: stored?.title ?? "",
        addedAt: stored?.addedAt ?? 0,
        deleted: true,
        bytes: 0,
        seq: nextSeq(),
        data: null,
      });
    },
  };
}
