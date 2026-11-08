import { Request, Response, NextFunction } from "express";
import { startTime } from "pino-http";
import { AppError } from "./AppError";
import { errorResponse } from "../response/response";
import { logger } from "../logger/logger";

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (res.headersSent) {
    return next(err);
  }

  const appError = normalizeError(err);
  const requestId = req.id === undefined ? undefined : String(req.id);

  if (appError.statusCode >= 400) {
    const requestLogger = req.log ?? logger;
    const startedAt = res[startTime];

    const logContext = {
      ...(appError.statusCode >= 500 ? { err: asError(err) } : {}),
      requestId,
      method: req.method,
      path: req.path,
      statusCode: appError.statusCode,
      errorCode: appError.code,
      ...(typeof startedAt === "number"
        ? { durationMs: Date.now() - startedAt }
        : {}),
      ...appError.details,
    };

    if (appError.statusCode >= 500) {
      requestLogger.error(logContext, "HTTP request failed");
    } else {
      requestLogger.warn(logContext, "HTTP request rejected");
    }
  }

  const exposeMessage = appError.isOperational;
  const message = exposeMessage ? appError.message : "Internal server error";

  return errorResponse(
    res,
    {
      code: exposeMessage ? appError.code : "INTERNAL_SERVER_ERROR",
      message,
      requestId,
      ...(exposeMessage && appError.publicDetails
        ? { details: appError.publicDetails }
        : {}),
    },
    appError.statusCode,
  );
}

function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    error.type === "entity.parse.failed"
  ) {
    return new AppError(400, "Request body contains invalid JSON", true, {
      code: "INVALID_JSON",
    });
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    error.type === "entity.too.large"
  ) {
    return new AppError(413, "Request body exceeds the allowed size", true, {
      code: "REQUEST_BODY_TOO_LARGE",
    });
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "LIMIT_FILE_SIZE"
  ) {
    return new AppError(413, "Uploaded file exceeds the allowed size", true, {
      code: "UPLOAD_TOO_LARGE",
    });
  }

  return new AppError(500, "Internal server error", false, {
    code: "INTERNAL_SERVER_ERROR",
    cause: error,
  });
}

function asError(error: unknown): Error {
  return error instanceof Error
    ? error
    : new Error("A non-Error value was thrown", { cause: error });
}
