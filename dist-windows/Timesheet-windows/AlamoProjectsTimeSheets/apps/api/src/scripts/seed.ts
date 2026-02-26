import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runSeeds(): Promise<void> {
  const seedsDir = path.resolve(__dirname, "../../../../db/seeds");
  const files = (await readdir(seedsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  await pool.query(`
    CREATE TABLE IF NOT EXISTS seed_history (
      seed_key TEXT PRIMARY KEY,
      checksum_sha256 CHAR(64) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  for (const file of files) {
    const fullPath = path.join(seedsDir, file);
    const sql = await readFile(fullPath, "utf8");
    console.log(`Applying seed ${file}`);
    await pool.query(sql);
  }

  console.log(`Applied ${files.length} seed files.`);
}

runSeeds()
  .catch((error) => {
    console.error("Seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
