import { readConfig } from "./config";
import { connect } from "./db";
import { MAX_BODY_BYTES, handle } from "./handler";
import { createSqlStore } from "./lexicon/sql-store";
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

Bun.serve({
  port: config.port,
  maxRequestBodySize: MAX_BODY_BYTES,
  fetch: (request) =>
    handle(request, {
      store,
      allowedOrigin: config.allowedOrigin,
      ...(translate ? { translate } : {}),
    }),
});

console.log(`api listening on :${config.port}`);
