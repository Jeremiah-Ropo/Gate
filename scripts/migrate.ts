import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  console.log("[migrate] Applying pending migrations...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("[migrate] Done.");

  await pool.end();
}

run().catch((error) => {
  console.error("[migrate] Failed:", error);
  process.exit(1);
});
