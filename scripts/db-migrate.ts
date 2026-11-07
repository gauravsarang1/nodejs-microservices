
import type { PoolClient } from "pg";
import { config } from "dotenv";
import { readdirSync, readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { getPool, closePool } from "../packages/shared/src/db/pool.ts";

config({ path: resolve(process.cwd(), ".env") });

async function main() {
  const dir = resolve(process.cwd(), "sql");
  const files = readdirSync(dir)
    .filter((file) => extname(file).toLowerCase() === ".sql")
    .sort();

  if (!files.length) return console.log("No SQL migrations found.");

  const pool = getPool();
  let client: PoolClient | undefined;
  let locked = false;

  try {
    client = await pool.connect();

    await client.query("SELECT pg_advisory_lock(hashtext($1))", [
      "nodejs-microservices:sql-migrations",
    ]);
    locked = true;

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    for (const file of files) {
      const { rowCount } = await client.query(
        "SELECT 1 FROM schema_migrations WHERE filename = $1",
        [file],
      );

      if (rowCount) {
        console.log(`Skipped: ${file} (already applied)`);
        continue;
      }

      try {
        await client.query("BEGIN");
        await client.query(readFileSync(resolve(dir, file), "utf8"));
        await client.query(
          "INSERT INTO schema_migrations (filename) VALUES ($1)",
          [file],
        );
        await client.query("COMMIT");
        console.log(`Migrated: ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }
  } finally {
    try {
      if (locked && client)
        await client.query("SELECT pg_advisory_unlock(hashtext($1))", [
          "nodejs-microservices:sql-migrations",
        ]);
    } finally {
      client?.release();
      await closePool();
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
