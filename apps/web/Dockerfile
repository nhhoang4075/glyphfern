FROM oven/bun:1.4.3-slim AS build

WORKDIR /app
COPY package.json bun.lock tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/core/package.json packages/core/
COPY packages/languages/package.json packages/languages/
COPY packages/ui/package.json packages/ui/
RUN bun install --frozen-lockfile

COPY packages packages
COPY apps/web apps/web

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN cd apps/web && bunx vite build --logLevel=error

FROM oven/bun:1.4.3-slim
WORKDIR /app
COPY --from=build /app/apps/web/dist ./dist
COPY apps/web/serve.ts ./serve.ts
ENV NODE_ENV=production
USER bun
CMD ["bun", "serve.ts"]
