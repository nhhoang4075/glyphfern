import { SQL } from "bun";
import { SCHEMA_SQL } from "./schema";

export function connect(databaseUrl: string): SQL {
  return new SQL(databaseUrl);
}

export async function migrate(sql: SQL): Promise<void> {
  await sql.unsafe(SCHEMA_SQL);
}
