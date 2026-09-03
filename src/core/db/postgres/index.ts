import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { DATABASE } from "../../global/config";
import logger from "../../global/utils/logger";
import * as schema from "./schema";

let pool: Pool;
let db: NodePgDatabase<typeof schema>;

export const connectDB = async (): Promise<void> => {
  if (!DATABASE.URL) {
    throw new Error("DATABASE_URL is not defined");
  }

  pool = new Pool({ connectionString: DATABASE.URL });
  pool.on("error", (err) => logger.error({ err }, "Postgres pool error"));

  db = drizzle(pool, { schema });
  await pingDB();
  logger.info("Postgres connection successful");
};

export const pingDB = async (): Promise<void> => {
  if (!pool) throw new Error("Database pool is not initialized");
  await pool.query("SELECT 1");
};

export const disconnectDB = async (): Promise<void> => {
  if (!pool) return;
  await pool.end();
};

export const getDb = (): NodePgDatabase<typeof schema> => {
  if (!db) {
    throw new Error("Database not initialized. Call connectDB() before getDb().");
  }
  return db;
};

export * from "./schema";
