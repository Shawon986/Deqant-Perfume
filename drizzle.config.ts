import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const host = process.env.TIDB_HOST;
const user = process.env.TIDB_USER;
const password = process.env.TIDB_PASSWORD;
const database = process.env.TIDB_DATABASE;

if (!host || !user || !database) {
  throw new Error("TIDB_HOST, TIDB_USER and TIDB_DATABASE are required to run Drizzle commands");
}

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "mysql",
  dbCredentials: {
    host,
    port: Number(process.env.TIDB_PORT || 4000),
    user,
    password: password ?? "",
    database,
    ssl: process.env.TIDB_ENABLE_SSL === "false" ? undefined : { minVersion: "TLSv1.2" },
  },
});
