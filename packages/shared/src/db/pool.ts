import dns from "node:dns";
import net from "node:net";
import { Pool, type PoolConfig } from "pg";
import { logger } from "../logger/logger";

let pool: Pool | null = null;

function getPositiveInt(name: string, fallback: number): number {
  const rawValue = process.env[name];

  if (!rawValue) {
    return fallback;
  }

  const parsed = Number(rawValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeDatabaseConfig(): PoolConfig {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(connectionString);
  } catch {
    throw new Error("DATABASE_URL is invalid");
  }

  if (!parsedUrl.hostname) {
    throw new Error("DATABASE_URL hostname is not set");
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

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
