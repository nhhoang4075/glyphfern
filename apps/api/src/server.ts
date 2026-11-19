import { readConfig } from "./config";
import { connect } from "./db";
import { MAX_BODY_BYTES, handle } from "./handler";
import { createSqlStore } from "./lexicon/sql-store";
import { createClientLimiter } from "./translate/client-limiter";
import { createCloudflareTranslator } from "./translate/cloudflare-translator";
import { createSqlCache } from "./translate/sql-cache";
import { createDailyBudget, createTranslateService } from "./translate/translate-service";

const config = readConfig();
const sql = connect(config.databaseUrl);
const store = createSqlStore(sql);
const translate =
  config.cloudflareAccountId && config.cloudflareApiToken
    ? createTranslateService(
        createCloudflareTranslator({
          accountId: config.cloudflareAccountId,
          apiToken: config.cloudflareApiToken,
        }),
        createSqlCache(sql),
        createDailyBudget(config.translateDailyCharLimit),
      )
    : undefined;

const limiter = createClientLimiter({
  requestsPerMinute: config.clientRequestsPerMinute,
  charactersPerDay: config.clientDailyCharLimit,
});

function clientOf(request: Request, address: string | undefined): string {
  if (config.trustProxy) {
    const forwarded = request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
    if (forwarded) {
      return forwarded;
    }
  }
  return address ?? "unknown";
}

const server = Bun.serve({
  port: config.port,
  maxRequestBodySize: MAX_BODY_BYTES,
  fetch: (request, bunServer) =>
    handle(
      request,
      {
        store,
        allowedOrigin: config.allowedOrigin,
        limiter,
        ...(translate ? { translate } : {}),
      },
      clientOf(request, bunServer.requestIP(request)?.address),
    ),
});

console.log(`api listening on :${server.port}`);
