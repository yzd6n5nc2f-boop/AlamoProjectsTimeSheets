import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations(): Promise<void> {
  const migrationsDir = path.resolve(__dirname, "../../../../db/migrations");
  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      migration_file TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const appliedResult = await pool.query<{ migration_file: string }>(
    "SELECT migration_file FROM schema_migrations"
  );
  const applied = new Set(appliedResult.rows.map((row: { migration_file: string }) => row.migration_file));

  let appliedCount = 0;

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`Skipping migration ${file} (already applied)`);
      continue;
    }

    const fullPath = path.join(migrationsDir, file);
    const sql = await readFile(fullPath, "utf8");
    console.log(`Applying migration ${file}`);
    await pool.query("BEGIN");
    try {
      await pool.query(sql);
      await pool.query("INSERT INTO schema_migrations (migration_file) VALUES ($1)", [file]);
      await pool.query("COMMIT");
      appliedCount += 1;
    } catch (error) {
      await pool.query("ROLLBACK");
      throw error;
    }
  }

  console.log(`Applied ${appliedCount} new migrations out of ${files.length} files.`);
}

runMigrations()
  .catch((error) => {
    console.error("Migration failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
