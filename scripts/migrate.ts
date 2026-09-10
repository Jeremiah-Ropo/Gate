import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

async function bootstrapAdmin(pool: Pool): Promise<void> {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) return;

  const result = await pool.query(
    `UPDATE users SET role = 'admin', updated_at = now() WHERE email = $1 RETURNING id, email, role`,
    [email],
  );

  if (result.rowCount === 0) {
    console.warn(`[bootstrap] No user found for email: ${email}`);
    return;
  }

  console.log(`[bootstrap] Promoted ${result.rows[0].email} to admin (${result.rows[0].id})`);
}

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  console.log("[migrate] Applying pending migrations...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("[migrate] Done.");

  await bootstrapAdmin(pool);
  await pool.end();
}

run().catch((error) => {
  console.error("[migrate] Failed:", error);
  process.exit(1);
});
