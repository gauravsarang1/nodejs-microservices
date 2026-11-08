export interface AppErrorOptions {
  code?: string;
  cause?: unknown;
  details?: Record<string, unknown>;
  publicDetails?: Record<string, unknown>;
}

const DEFAULT_ERROR_CODES: Record<number, string> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  413: "PAYLOAD_TOO_LARGE",
  422: "VALIDATION_FAILED",
  429: "RATE_LIMIT_EXCEEDED",
  502: "BAD_GATEWAY",
  503: "SERVICE_UNAVAILABLE",
  504: "GATEWAY_TIMEOUT",
};

export class AppError extends Error {
  readonly statusCode: number;
  readonly isOperational: boolean;
  readonly code: string;
  readonly details?: Record<string, unknown>;
  readonly publicDetails?: Record<string, unknown>;

  constructor(
    statusCode: number,
    message: string,
    isOperational = true,
    options: AppErrorOptions = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "AppError";
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code =
      options.code ?? DEFAULT_ERROR_CODES[statusCode] ?? "INTERNAL_SERVER_ERROR";
    this.details = options.details;
    this.publicDetails = options.publicDetails;
  }
}
