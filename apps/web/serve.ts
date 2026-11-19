import { join } from "node:path";

const DIST = join(import.meta.dir, "dist");
const INDEX = join(DIST, "index.html");
const HASHED_ASSETS = "/assets/";
const IMMUTABLE = "public, max-age=31536000, immutable";
const REVALIDATE = "no-cache";
const port = Number(process.env.PORT ?? 8080);

function insideDist(path: string): boolean {
  return path === DIST || path.startsWith(`${DIST}/`);
}

Bun.serve({
  port,
  async fetch(request) {
    const pathname = decodeURIComponent(new URL(request.url).pathname);
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
