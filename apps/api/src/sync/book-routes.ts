import { authenticate, notConfigured } from "../auth/auth-routes";
import { empty, json } from "../http";
import { BOOK_ID_PATTERN } from "./records";
import type { SyncDeps } from "./sync-routes";

export const MAX_BOOK_UPLOAD_BYTES = 32 * 1024 * 1024;
const MAX_TITLE_CHARS = 300;
const SUPPORTED_BOOK_LANGS = new Set(["es"]);

function hasGzipMagic(data: Uint8Array): boolean {
  return data.length > 2 && data[0] === 0x1f && data[1] === 0x8b;
}

export async function bookRoute(request: Request, url: URL, deps: SyncDeps): Promise<Response> {
  const id = decodeId(url.pathname.slice("/books/".length));
  if (id === undefined || !BOOK_ID_PATTERN.test(id)) {
    return json({ error: "invalid_book_id" }, 400, deps);
  }
  if (!["PUT", "GET", "DELETE"].includes(request.method)) {
    return json({ error: "method_not_allowed" }, 405, deps);
  }
  if (!deps.auth || !deps.sync) {
    return notConfigured(deps);
  }
  const session = await authenticate(request, deps);
  if (session instanceof Response) {
    return session;
  }
  const userId = session.user.id;
  if (request.method === "GET") {
    const data = await deps.sync.getBook(userId, id);
    return data
      ? new Response(new Uint8Array(data), {
          status: 200,
          headers: {
            "content-type": "application/gzip",
            "access-control-allow-origin": deps.allowedOrigin,
          },
        })
      : json({ error: "not_found" }, 404, deps);
  }
  if (request.method === "DELETE") {
    await deps.sync.deleteBook(userId, id);
    return empty(204, deps);
  }
  return putRoute(request, url, deps, id, userId);
}

function decodeId(raw: string): string | undefined {
  try {
    return decodeURIComponent(raw);
  } catch {
    return undefined;
  }
}

async function putRoute(
  request: Request,
  url: URL,
  deps: SyncDeps,
  id: string,
  userId: string,
): Promise<Response> {
  const store = deps.sync;
  if (!store) {
    return notConfigured(deps);
  }
  const lang = url.searchParams.get("lang") ?? "";
  const title = url.searchParams.get("title") ?? "";
  const rawAddedAt = url.searchParams.get("addedAt");
  const addedAt = rawAddedAt === null ? Date.now() : Number(rawAddedAt);
  if (!SUPPORTED_BOOK_LANGS.has(lang)) {
    return json({ error: "unsupported_language" }, 400, deps);
  }
  if (title.length === 0 || title.length > MAX_TITLE_CHARS) {
    return json({ error: "invalid_title" }, 400, deps);
  }
  if (!Number.isSafeInteger(addedAt) || addedAt < 0) {
    return json({ error: "invalid_added_at" }, 400, deps);
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/gzip")) {
    return json({ error: "unsupported_media_type" }, 415, deps);
  }
  const declared = Number(request.headers.get("content-length") ?? Number.NaN);
  if (!Number.isFinite(declared) || declared > MAX_BOOK_UPLOAD_BYTES) {
    return json({ error: "payload_too_large" }, 413, deps);
  }
  const data = new Uint8Array(await request.arrayBuffer());
  if (data.length > MAX_BOOK_UPLOAD_BYTES) {
    return json({ error: "payload_too_large" }, 413, deps);
  }
  if (!hasGzipMagic(data)) {
    return json({ error: "invalid_body" }, 400, deps);
  }
  const result = await store.putBook(userId, { id, lang, title, addedAt, data });
  return result === "stored" ? empty(204, deps) : json({ error: "quota_exceeded" }, 413, deps);
}
