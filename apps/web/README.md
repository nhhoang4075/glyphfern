# Web app

`serve.ts` is the production static server and `/api/` proxy. It routes on the raw request path, pins the upstream origin to `API_ORIGIN` and never follows redirects.

## Request body limits

`body-limit.ts` decides the cap per request: `PUT /api/books/<id>` may carry up to 32 MB (a gzip-compressed book), every other route is limited to 512 KB. Bun is configured with the larger cap and `readBodyWithin` enforces the per-route cap by the declared length and again while streaming, answering 413 when exceeded. The Dockerfile copies `body-limit.ts` next to `serve.ts`.
