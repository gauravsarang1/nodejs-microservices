import type { Request, NextFunction, Response } from "express";
import { AppError } from "../errors/AppError";

//read GATEWAY_SECRET from env
// compare to incoming x-gateway-secret
// match -> next(); missing/mismatch -> 403
export function requireGatewaySecret(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const expected = process.env.GATEWAY_SECRET;

  if (!expected) {
    return next(
      new AppError(500, "Gateway authentication is not configured", false, {
        code: "CONFIGURATION_MISSING",
        details: { key: "GATEWAY_SECRET" },
      }),
    );
  }

  const incoming = req.header("x-gateway-secret");

  if (!incoming || incoming !== expected) {
    return next(
      new AppError(401, "Invalid gateway credentials", true, {
        code: "GATEWAY_AUTHENTICATION_FAILED",
      }),
    );
  }

  next();
}
