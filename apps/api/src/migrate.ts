import { readConfig } from "./config";
import { connect, migrate } from "./db";

const sql = connect(readConfig().databaseUrl);
await migrate(sql);
await sql.close();
console.log("schema is up to date");
