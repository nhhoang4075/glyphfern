import type { BookUploadMeta, PullResponse, PushResponse, SyncRecord } from "./types";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
  ) {
    super(`request failed with ${status}`);
  }
}

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

export interface SyncApi {
  push(records: readonly SyncRecord[]): Promise<PushResponse>;
  pull(since: number, limit: number): Promise<PullResponse>;
  putBook(id: string, meta: BookUploadMeta, gzipped: Uint8Array): Promise<void>;
  getBook(id: string): Promise<Uint8Array | null>;
  deleteBook(id: string): Promise<void>;
}

export async function failIfNotOk(response: Response): Promise<Response> {
  if (response.ok) {
    return response;
  }
  let code: string | null = null;
  try {
    const body = (await response.json()) as { error?: unknown };
    code = typeof body.error === "string" ? body.error : null;
  } catch {
    code = null;
  }
  throw new HttpError(response.status, code);
}

export function createSyncApi(baseUrl: string, token: string, fetcher: Fetcher): SyncApi {
  const authorization = { authorization: `Bearer ${token}` };
  const json = { ...authorization, "content-type": "application/json" };

  return {
    async push(records) {
      const response = await fetcher(`${baseUrl}/sync/push`, {
        method: "POST",
        headers: json,
        body: JSON.stringify({ records }),
      });
      return (await failIfNotOk(response)).json() as Promise<PushResponse>;
    },
    async pull(since, limit) {
      const response = await fetcher(`${baseUrl}/sync/pull?since=${since}&limit=${limit}`, {
        headers: authorization,
      });
      return (await failIfNotOk(response)).json() as Promise<PullResponse>;
    },
    async putBook(id, meta, gzipped) {
      const query = new URLSearchParams({
        lang: meta.lang,
        title: meta.title,
        addedAt: String(meta.addedAt),
      });
      const response = await fetcher(`${baseUrl}/books/${encodeURIComponent(id)}?${query}`, {
        method: "PUT",
        headers: { ...authorization, "content-type": "application/gzip" },
        body: new Blob([gzipped as Uint8Array<ArrayBuffer>]),
      });
      await failIfNotOk(response);
    },
    async getBook(id) {
      const response = await fetcher(`${baseUrl}/books/${encodeURIComponent(id)}`, {
        headers: authorization,
      });
      if (response.status === 404) {
        return null;
      }
      return new Uint8Array(await (await failIfNotOk(response)).arrayBuffer());
    },
    async deleteBook(id) {
      const response = await fetcher(`${baseUrl}/books/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: authorization,
      });
      if (response.status !== 404) {
        await failIfNotOk(response);
      }
    },
  };
}
