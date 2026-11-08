import pino, { type Logger } from "pino";
import { createHttpLogger } from "./httpLogger";

function createLogger(service?: string): Logger {
  return pino({
    level: process.env.LOG_LEVEL || "info",
    base: service ? { service } : undefined,
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "req.headers.x-gateway-secret",
        "req.headers.x-user-id",
        "req.headers.x-user-role",
        "password",
        "passwordHash",
        "password_hash",
        "token",
        "accessToken",
        "refreshToken",
      ],
      censor: "[REDACTED]",
    },
  });
}

export let logger = createLogger();

export function configureServiceLogging(service: string) {
  logger = createLogger(service);
  return createHttpLogger(logger);
}
