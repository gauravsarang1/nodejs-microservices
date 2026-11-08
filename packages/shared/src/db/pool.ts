import dns from "node:dns";
import net from "node:net";
import { Pool, type PoolConfig } from "pg";
import { logger } from "../logger/logger";
import { AppError } from "../errors/AppError";
import { runDatabaseQuery } from "./databaseError";

let pool: Pool | null = null;

function getPositiveInt(name: string, fallback: number): number {
  const rawValue = process.env[name];

  if (rawValue === undefined) {
    return fallback;
  }

  const parsed = Number(rawValue);
  if (!/^\d+$/.test(rawValue) || !Number.isSafeInteger(parsed) || parsed < 1) {
    throw new AppError(500, `${name} must be a positive integer`, false, {
      code: "CONFIGURATION_INVALID",
      details: { key: name },
    });
  }

  return parsed;
}

function normalizeDatabaseConfig(): PoolConfig {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new AppError(500, "DATABASE_URL is not set", false, {
      code: "CONFIGURATION_MISSING",
      details: { key: "DATABASE_URL" },
    });
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(connectionString);
  } catch (cause) {
    throw new AppError(500, "DATABASE_URL is invalid", false, {
      code: "CONFIGURATION_INVALID",
      cause,
      details: { key: "DATABASE_URL" },
    });
  }

  if (!parsedUrl.hostname) {
    throw new AppError(500, "DATABASE_URL hostname is not set", false, {
      code: "CONFIGURATION_INVALID",
      details: { key: "DATABASE_URL" },
    });
  }

  const isLocalDatabase =
    parsedUrl.hostname === "localhost" || parsedUrl.hostname === "127.0.0.1";

  if (!isLocalDatabase) {
    parsedUrl.searchParams.set("sslmode", "verify-full");
  }

  const sslEnabled = !isLocalDatabase && parsedUrl.searchParams.get("sslmode") !== "disable";

  return {
    connectionString: parsedUrl.toString(),
    max: getPositiveInt("DB_POOL_MAX", 10),
    idleTimeoutMillis: getPositiveInt("DB_IDLE_TIMEOUT_MS", 30_000),
    connectionTimeoutMillis: getPositiveInt("DB_CONNECTION_TIMEOUT_MS", 5_000),
    keepAlive: true,
    ssl: sslEnabled ? { rejectUnauthorized: true } : false,
    application_name: process.env.APP_NAME ?? "nodejs-microservices",
  };
}

export function getPool(): Pool {
  if (!pool) {
    dns.setDefaultResultOrder("ipv4first");
    net.setDefaultAutoSelectFamily(false);

    const poolConfig = normalizeDatabaseConfig();
    pool = new Pool(poolConfig);

    pool.on("error", (error) => {
      logger.error({ err: error }, "PostgreSQL pool error");
    });
  }

  return pool;
}

export async function verifyDatabaseConnection(): Promise<void> {
  await runDatabaseQuery("connect", "database", () =>
    getPool().query("SELECT 1"),
  );
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
