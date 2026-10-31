import { createPool } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { env } from "../lib/env";
import * as schema from "@db/schema";
import * as relations from "@db/relations";

const fullSchema = { ...schema, ...relations };

function createDatabase() {
  const pool = createPool({
    host: env.dbHost,
    port: env.dbPort,
    user: env.dbUser,
    password: env.dbPassword,
    database: env.dbName,
    ssl: env.dbSsl ? { minVersion: "TLSv1.2" } : undefined,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    enableKeepAlive: true,
  });

  return drizzle(pool, { mode: "default", schema: fullSchema });
}

type Database = ReturnType<typeof createDatabase>;
let instance: Database | undefined;

export function getDb(): Database {
  if (!instance) instance = createDatabase();
  return instance;
}
