# Railway deployment

Purpose: the infrastructure of Glyphfern on Railway, written as code in `railway.ts` (Railway IaC, `partial = "glyphfern"`, so only the resources listed there are owned by the file).

## Services

| Service | Source | Role | Exposure |
| --- | --- | --- | --- |
| `web` | `apps/web/Dockerfile` | Vite build served by `apps/web/serve.ts` (static files, fallback to `index.html`) | `glyphfern.nguyenhuyhoang.work` |
| `api` | `apps/api/Dockerfile` | Bun API; `bun src/migrate.ts` runs as the pre-deploy command | `api.glyphfern.nguyenhuyhoang.work` |
| `tts` | `apps/tts/Dockerfile` (root directory `apps/tts`) | Kokoro sidecar | private network only, port 8788 |
| `Postgres` | Railway template, created in the dashboard | database | private network |

`railway.ts` does not describe Postgres: deploy the PostgreSQL template from the dashboard and keep its service named `Postgres`, because `api` reads `DATABASE_URL` as `${{Postgres.DATABASE_URL}}`.

## Variables

Written in `railway.ts`: `DATABASE_URL`, `ALLOWED_ORIGIN`, `TRUST_PROXY=1`, `TTS_URL` (the private domain of `tts`), `VITE_API_URL` and `PORT` of `web`. `VITE_API_URL` is read at build time as a Docker build argument, so changing it needs a new build of `web`.

Not written: `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` of `api` use `preserve()`. Set them once in the dashboard; apply never overwrites them. Without them translation answers 503 and the rest still works.

## First deployment

1. Create the project in the dashboard, add the PostgreSQL template, run `railway link` in the repository.
2. `railway config plan`, then `railway config apply`.
3. Set the two Cloudflare variables on `api` in the dashboard.
4. Add the DNS records Railway shows for the two custom domains (CNAME to the Railway target, plus the TXT verification record) at the DNS provider of `nguyenhuyhoang.work`.
5. Load the dictionary once into the Railway database: `bun run migrate`, then `bun run load-lexicon <kaikki.jsonl> es`, run locally with `DATABASE_URL` set to the `DATABASE_PUBLIC_URL` of `Postgres` (see `apps/api/README.md`).

## Failure modes

- `tts` is slow to start (model load); its health check allows 120 seconds. While it is down `/tts` answers 502 and the web app speaks with the system voice.
- The private network name `tts.railway.internal` must resolve over the network the Python server listens on (`0.0.0.0`). If `api` cannot reach it, the symptom is `/tts` answering 502; check the network setting of the environment before changing code.
- Changing `ALLOWED_ORIGIN` or a domain needs both `api` and `web` redeployed: CORS and `VITE_API_URL` are fixed at start and build.

## Testing

`railway config plan` shows the changes without applying them. `bunx tsc --noEmit -p .railway/tsconfig.json` type-checks the file. The configuration has not been planned against a real Railway project yet.
