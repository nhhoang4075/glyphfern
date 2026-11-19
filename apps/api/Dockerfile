FROM oven/bun:1.4.3-slim

WORKDIR /app
ENV NODE_ENV=production

COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/core/package.json packages/core/
COPY packages/languages/package.json packages/languages/
COPY packages/ui/package.json packages/ui/
RUN bun install --frozen-lockfile --production

COPY --chown=bun:bun tsconfig.base.json ./
COPY --chown=bun:bun apps/api apps/api
USER bun
WORKDIR /app/apps/api
CMD ["bun", "src/server.ts"]
