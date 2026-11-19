import { readConfig } from "./config";
import { connect } from "./db";
import { handle } from "./handler";
import { createSqlStore } from "./lexicon/sql-store";

const config = readConfig();
const store = createSqlStore(connect(config.databaseUrl));

Bun.serve({
  port: config.port,
  fetch: (request) => handle(request, { store, allowedOrigin: config.allowedOrigin }),
});

console.log(`api listening on :${config.port}`);
