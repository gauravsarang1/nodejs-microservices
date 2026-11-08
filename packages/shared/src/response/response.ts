import type { Response } from "express";

export function successResponse(
  res: Response,
  data: unknown,
  statusCode = 200,
) {
  return res.status(statusCode).json({
    success: true,
    data,
  });
}

export function failResponse(res: Response, message: string, statusCode = 400) {
  return res.status(statusCode).json({
    success: false,
    message,
  });
}

export function errorResponse(
  res: Response,
  input: {
    code: string;
    message: string;
    requestId?: string;
    details?: Record<string, unknown>;
  },
  statusCode: number,
) {
  return res.status(statusCode).json({
    success: false,
    message: input.message,
    error: {
      code: input.code,
      message: input.message,
      ...(input.details ? { details: input.details } : {}),
      ...(input.requestId ? { requestId: input.requestId } : {}),
    },
  });
}
