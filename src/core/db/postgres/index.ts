import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import type { NodePgTransaction } from "drizzle-orm/node-postgres";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import { Pool } from "pg";

import { DATABASE } from "../../global/config";
import logger from "../../global/utils/logger";
import * as schema from "./schema";

let pool: Pool;
let db: NodePgDatabase<typeof schema>;

export type DbTransaction = NodePgTransaction<typeof schema, ExtractTablesWithRelations<typeof schema>>;
export type DbExecutor = NodePgDatabase<typeof schema> | DbTransaction;

export const connectDB = (): void => {
  if (!DATABASE.URL) {
    logger.error("DATABASE_URL is not defined, exiting now...");
    process.exit(1);
  }

  pool = new Pool({ connectionString: DATABASE.URL });
  pool.on("error", (err) => logger.error(`Postgres pool error: ${err}`));

  db = drizzle(pool, { schema });

  pool
    .query("SELECT 1")
    .then(() => logger.info("Postgres connection successful"))
    .catch((err) => {
      logger.error(`Postgres connection failed: ${err}`);
      process.exit(1);
    });
};

export const getDb = (): NodePgDatabase<typeof schema> => {
  if (!db) {
    throw new Error("Database not initialized. Call connectDB() before getDb().");
  }
  return db;
};

export const withTransaction = async <T>(work: (tx: DbTransaction) => Promise<T>): Promise<T> => {
  return getDb().transaction(work);
};

export * from "./schema";
