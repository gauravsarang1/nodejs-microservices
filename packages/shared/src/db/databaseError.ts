import { AppError } from "../errors/AppError";

const CONNECTION_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ETIMEDOUT",
]);

function getErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  if ("code" in error && typeof error.code === "string") {
    return error.code;
  }

  if ("errors" in error && Array.isArray(error.errors)) {
    for (const nestedError of error.errors) {
      const code = getErrorCode(nestedError);
      if (code) {
        return code;
      }
    }
  }

  if ("cause" in error) {
    return getErrorCode(error.cause);
  }

  return undefined;
}

export async function runDatabaseQuery<T>(
  operation: string,
  resource: string,
  query: () => Promise<T>,
): Promise<T> {
  try {
    return await query();
  } catch (cause) {
    if (cause instanceof AppError) {
      throw cause;
    }

    const databaseCode = getErrorCode(cause);
    const details = {
      operation,
      resource,
      ...(databaseCode ? { databaseCode } : {}),
    };

    if (databaseCode && CONNECTION_ERROR_CODES.has(databaseCode)) {
      throw new AppError(503, "Database connection failed", true, {
        code: "DATABASE_UNAVAILABLE",
        cause,
        details,
      });
    }

    if (databaseCode === "57014") {
      throw new AppError(504, "Database query timed out", true, {
        code: "DATABASE_QUERY_TIMEOUT",
        cause,
        details,
      });
    }

    if (databaseCode === "23505" || databaseCode === "23503") {
      throw new AppError(409, "Database constraint conflict", true, {
        code:
          databaseCode === "23505"
            ? "DATABASE_UNIQUE_CONSTRAINT"
            : "DATABASE_FOREIGN_KEY_CONSTRAINT",
        cause,
        details,
      });
    }

    if (databaseCode === "40001" || databaseCode === "40P01") {
      throw new AppError(409, "Database transaction conflict", true, {
        code: "DATABASE_CONCURRENCY_CONFLICT",
        cause,
        details,
      });
    }

    throw new AppError(
      500,
      `Database operation "${operation}" failed for ${resource}`,
      false,
      {
        code: "DATABASE_QUERY_FAILED",
        cause,
        details,
      },
    );
  }
}
