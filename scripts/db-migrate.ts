
import type { PoolClient } from "pg";
import { config } from "dotenv";
import { readdirSync, readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { getPool, closePool } from "../packages/shared/src/db/pool.ts";
import { AppError } from "../packages/shared/src/errors/AppError.ts";
import {
  configureServiceLogging,
  logger,
} from "../packages/shared/src/logger/logger.ts";

config({ path: resolve(process.cwd(), ".env") });
configureServiceLogging("db-migrate");

async function main() {
  const dir = resolve(process.cwd(), "sql");
  const files = readdirSync(dir)
    .filter((file) => extname(file).toLowerCase() === ".sql")
    .sort();

  if (!files.length) {
    logger.info("No SQL migrations found");
    return;
  }

  const pool = getPool();
  let client: PoolClient | undefined;
  let locked = false;
  let operationFailed = false;
  let operationError: unknown;

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
        logger.info({ migration: file }, "Migration already applied");
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
        logger.info({ migration: file }, "Migration applied");
      } catch (err) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          throw new AppError(
            500,
            `Migration ${file} failed and rollback also failed`,
            false,
            {
              code: "MIGRATION_ROLLBACK_FAILED",
              cause: new AggregateError(
                [err, rollbackError],
                "Migration and rollback failed",
                { cause: err },
              ),
              details: { migration: file },
            },
          );
        }

        throw new AppError(500, `Migration ${file} failed`, false, {
          code: "MIGRATION_FAILED",
          cause: err,
          details: { migration: file },
        });
      }
    }
  } catch (cause) {
    operationFailed = true;
    operationError = cause;
    throw cause;
  } finally {
    const cleanupFailures: unknown[] = [];

    try {
      if (locked && client) {
        await client.query("SELECT pg_advisory_unlock(hashtext($1))", [
          "nodejs-microservices:sql-migrations",
        ]);
      }
    } catch (cause) {
      cleanupFailures.push(cause);
    }

    try {
      client?.release();
    } catch (cause) {
      cleanupFailures.push(cause);
    }

    try {
      await closePool();
    } catch (cause) {
      cleanupFailures.push(cause);
    }

    if (cleanupFailures.length > 0) {
      const cleanupError = new AppError(
        500,
        "Database migration cleanup failed",
        false,
        {
          code: "MIGRATION_CLEANUP_FAILED",
          cause: new AggregateError(cleanupFailures, "Migration cleanup failed"),
          details: { operation: "cleanup_migration_resources" },
        },
      );

      if (operationFailed) {
        throw new AppError(
          500,
          "Database migration and cleanup both failed",
          false,
          {
            code: "MIGRATION_AND_CLEANUP_FAILED",
            cause: new AggregateError(
              [operationError, cleanupError],
              "Database migration and cleanup both failed",
              { cause: operationError },
            ),
            details: { operation: "run_and_cleanup_migration" },
          },
        );
      }

      throw cleanupError;
    }
  }
}

main().catch((err: unknown) => {
  logger.fatal(
    { err, operation: "database_migration" },
    "Migration process failed",
  );
  process.exitCode = 1;
});
