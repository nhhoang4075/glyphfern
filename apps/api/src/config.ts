export interface Config {
  port: number;
  databaseUrl: string;
  allowedOrigin: string;
  cloudflareAccountId: string | undefined;
  cloudflareApiToken: string | undefined;
  translateDailyCharLimit: number;
}

const DEFAULT_PORT = 8787;
const DEFAULT_DATABASE_URL = "postgres://localhost:5432/glyphfern";
const DEFAULT_ORIGIN = "http://localhost:5183";
const DEFAULT_DAILY_CHAR_LIMIT = 100_000;

export function readConfig(env: Record<string, string | undefined> = process.env): Config {
  const port = Number(env.PORT ?? DEFAULT_PORT);
  return {
    port: Number.isInteger(port) && port > 0 ? port : DEFAULT_PORT,
    databaseUrl: env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
    allowedOrigin: env.ALLOWED_ORIGIN ?? DEFAULT_ORIGIN,
    cloudflareAccountId: env.CLOUDFLARE_ACCOUNT_ID || undefined,
    cloudflareApiToken: env.CLOUDFLARE_API_TOKEN || undefined,
    translateDailyCharLimit: Number(env.TRANSLATE_DAILY_CHAR_LIMIT ?? DEFAULT_DAILY_CHAR_LIMIT),
  };
}
