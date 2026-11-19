import { join } from "node:path";
import {
  BOOK_UPLOAD_LIMIT_BYTES,
  BodyTooLargeError,
  bodyLimitFor,
  readBodyWithin,
} from "./body-limit";

const DIST = join(import.meta.dir, "dist");
const INDEX = join(DIST, "index.html");
const HASHED_ASSETS = "/assets/";
const API_PREFIX = "/api/";
const IMMUTABLE = "public, max-age=31536000, immutable";
const REVALIDATE = "no-cache";
const port = Number(process.env.PORT ?? 8080);
const IDLE_TIMEOUT_SECONDS = 60;
const apiOrigin = (process.env.API_ORIGIN ?? "").replace(/\/+$/, "");
const DROPPED_REQUEST_HEADERS = ["host", "connection", "content-length", "accept-encoding"];
const DROPPED_RESPONSE_HEADERS = [
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
];

function insideDist(path: string): boolean {
  return path === DIST || path.startsWith(`${DIST}/`);
}

async function forwardToApi(request: Request, url: URL): Promise<Response> {
  if (!apiOrigin) {
    return new Response("api not configured", { status: 503 });
  }
  const headers = new Headers(request.headers);
  for (const name of DROPPED_REQUEST_HEADERS) {
    headers.delete(name);
  }
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  let body: ArrayBuffer | undefined;
  if (hasBody) {
    try {
      body = await readBodyWithin(request, bodyLimitFor(request.method, url.pathname));
    } catch (error) {
      if (error instanceof BodyTooLargeError) {
        return new Response("request body too large", { status: 413 });
      }
      return new Response("bad request", { status: 400 });
    }
  }
  try {
    const upstream = await fetch(
      `${apiOrigin}${url.pathname.slice(API_PREFIX.length - 1)}${url.search}`,
      {
        method: request.method,
        headers,
        ...(body ? { body } : {}),
      },
    );
    const responseHeaders = new Headers(upstream.headers);
    for (const name of DROPPED_RESPONSE_HEADERS) {
      responseHeaders.delete(name);
    }
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return new Response("api unreachable", { status: 502 });
  }
}

Bun.serve({
  port,
  idleTimeout: IDLE_TIMEOUT_SECONDS,
  maxRequestBodySize: BOOK_UPLOAD_LIMIT_BYTES,
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname.startsWith(API_PREFIX)) {
      return forwardToApi(request, url);
    }
    const pathname = decodeURIComponent(url.pathname);
    if (pathname === "/health") {
      return new Response("ok");
    }
    const candidate = join(DIST, pathname);
    const file = insideDist(candidate) ? Bun.file(candidate) : Bun.file(INDEX);
    if (pathname !== "/" && (await file.exists()) && !candidate.endsWith("/")) {
      const cache = pathname.startsWith(HASHED_ASSETS) ? IMMUTABLE : REVALIDATE;
      return new Response(file, { headers: { "cache-control": cache } });
    }
    return new Response(Bun.file(INDEX), { headers: { "cache-control": REVALIDATE } });
  },
});
