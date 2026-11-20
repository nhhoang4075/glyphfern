export interface Config {
  port: number;
  databaseUrl: string;
  allowedOrigin: string;
  cloudflareAccountId: string | undefined;
  cloudflareApiToken: string | undefined;
  translateDailyCharLimit: number;
  grammarDailyCharLimit: number;
  clientDailyCharLimit: number;
  clientRequestsPerMinute: number;
  trustProxy: boolean;
  ttsUrl: string | undefined;
  ttsVoiceEs: string;
  ttsDailyCharLimit: number;
  aiGatewayApiKey: string | undefined;
  grammarModel: string;
  googleClientId: string | undefined;
  allowedEmails: string[];
}

const DEFAULT_PORT = 8787;
const DEFAULT_DATABASE_URL = "postgres://localhost:5432/glyphfern";
const DEFAULT_ORIGIN = "http://localhost:5183";
const DEFAULT_DAILY_CHAR_LIMIT = 100_000;
const DEFAULT_GRAMMAR_DAILY_CHARS = 50_000;
const DEFAULT_CLIENT_DAILY_CHARS = 20_000;
const DEFAULT_CLIENT_RPM = 30;
const DEFAULT_TTS_VOICE_ES = "em_alex";
const DEFAULT_TTS_DAILY_CHARS = 50_000;
const DEFAULT_GRAMMAR_MODEL = "deepseek/deepseek-v4.1-flash-1017";

export function readConfig(env: Record<string, string | undefined> = process.env): Config {
  const port = Number(env.PORT ?? DEFAULT_PORT);
  return {
    port: Number.isInteger(port) && port > 0 ? port : DEFAULT_PORT,
    databaseUrl: env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
    allowedOrigin: env.ALLOWED_ORIGIN ?? DEFAULT_ORIGIN,
    cloudflareAccountId: env.CLOUDFLARE_ACCOUNT_ID || undefined,
    cloudflareApiToken: env.CLOUDFLARE_API_TOKEN || undefined,
    translateDailyCharLimit: Number(env.TRANSLATE_DAILY_CHAR_LIMIT ?? DEFAULT_DAILY_CHAR_LIMIT),
    grammarDailyCharLimit: Number(env.GRAMMAR_DAILY_CHAR_LIMIT ?? DEFAULT_GRAMMAR_DAILY_CHARS),
    clientDailyCharLimit: Number(env.CLIENT_DAILY_CHAR_LIMIT ?? DEFAULT_CLIENT_DAILY_CHARS),
    clientRequestsPerMinute: Number(env.CLIENT_REQUESTS_PER_MINUTE ?? DEFAULT_CLIENT_RPM),
    trustProxy: env.TRUST_PROXY === "1",
    ttsUrl: env.TTS_URL || undefined,
    ttsVoiceEs: env.TTS_VOICE_ES || DEFAULT_TTS_VOICE_ES,
    ttsDailyCharLimit: Number(env.TTS_DAILY_CHAR_LIMIT ?? DEFAULT_TTS_DAILY_CHARS),
    aiGatewayApiKey: env.AI_GATEWAY_API_KEY || undefined,
    grammarModel: env.GRAMMAR_MODEL || DEFAULT_GRAMMAR_MODEL,
    googleClientId: env.GOOGLE_CLIENT_ID || undefined,
    allowedEmails: (env.ALLOWED_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email.length > 0),
  };
}
