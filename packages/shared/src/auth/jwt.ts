import jwt from "jsonwebtoken";
import type { JwtPayload } from "./types";
import { AppError } from "../errors/AppError";

function extractjwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new AppError(500, "JWT signing is not configured", false, {
      code: "CONFIGURATION_MISSING",
      details: { key: "JWT_SECRET" },
    });
  }

  return secret;
}

export function signToken(payload: JwtPayload): string {
  const expiresIn = process.env.JWT_EXPIRATION || "1h";

  return jwt.sign(payload, extractjwtSecret(), {
    expiresIn: expiresIn as jwt.SignOptions["expiresIn"],
  });
}

export function verifyToken(token: string): JwtPayload {
  let decodeToken: string | jwt.JwtPayload;

  try {
    decodeToken = jwt.verify(token, extractjwtSecret());
  } catch (cause) {
    if (cause instanceof AppError) {
      throw cause;
    }

    throw new AppError(401, "Invalid or expired authentication token", true, {
      code: "INVALID_AUTH_TOKEN",
      cause,
    });
  }

  if (
    typeof decodeToken !== "object" ||
    decodeToken === null ||
    typeof decodeToken.userId !== "string" ||
    (decodeToken.role !== "USER" && decodeToken.role !== "ADMIN")
  ) {
    throw new AppError(401, "Invalid authentication token payload", true, {
      code: "INVALID_AUTH_TOKEN",
    });
  }

  return {
    userId: decodeToken.userId,
    role: decodeToken.role,
  };
}
