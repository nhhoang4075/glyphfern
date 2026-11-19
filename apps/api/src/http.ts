export interface CorsDeps {
  allowedOrigin: string;
}

export const CACHE_SECONDS = 86400;

export function json(body: unknown, status: number, deps: CorsDeps, cache = false): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": deps.allowedOrigin,
      ...(cache ? { "cache-control": `public, max-age=${CACHE_SECONDS}` } : {}),
    },
  });
}

export function empty(status: number, deps: CorsDeps): Response {
  return new Response(null, {
    status,
    headers: { "access-control-allow-origin": deps.allowedOrigin },
  });
}
