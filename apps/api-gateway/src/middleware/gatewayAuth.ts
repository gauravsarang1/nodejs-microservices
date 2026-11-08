import type { Request, NextFunction, Response } from "express";
import { AppError, verifyToken } from "shared";
import { getAllowedRoles, isPublicRoute } from "../rbac";

const IDENTITY_HEADERS = [
  "x-user-id",
  "x-user-role",
  "x-gateway-secret",
] as const;

// trust any headers receive from client -> BIG NO
// B2C -> :3000/auth/me -H authrorization: Bearer <sangam-token>
// -H -> x-user-id -> john-user-id

function stripIdentityHeaders(req: Request) {
  for (const header of IDENTITY_HEADERS) {
    delete req.headers[header];
  }
}

// proves to auth service -> this req came through the gateway

function attachGatewaySecret(req: Request) {
  const secret = process.env.GATEWAY_SECRET;

  if (!secret) {
    throw new AppError(500, "Gateway authentication is not configured", false, {
      code: "CONFIGURATION_MISSING",
      details: { key: "GATEWAY_SECRET" },
    });
  }

  req.headers["x-gateway-secret"] = secret;
}

function requestPath(req: Request) {
  const combined = `${req.baseUrl}${req.path}`;

  if (combined.length > 1 && combined.endsWith("/")) {
    return combined.slice(0, -1);
  }

  return combined || "/";
}

function attachUserHeaders(req: Request, userId: string, role: string) {
  req.headers["x-user-id"] = userId;
  req.headers["x-user-role"] = role;
}

// main middleware
// run on every /auth request before the proxy forward to auth service

export function gatewayAuth(req: Request, _res: Response, next: NextFunction) {
  stripIdentityHeaders(req);
  attachGatewaySecret(req);

  const path = requestPath(req);

  if (isPublicRoute(req.method, path)) {
    return next();
  }

  const authHeader = req.header("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    throw new AppError(401, "Missing or invalid authentication token", true, {
      code: "INVALID_AUTH_TOKEN",
    });
  }

  const token = authHeader.slice("Bearer ".length).trim();
  const payload = verifyToken(token);
  const allowedRoles = getAllowedRoles(req.method, path);

  if (!allowedRoles) {
    throw new AppError(404, "Route not found");
  }

  if (!allowedRoles.includes(payload.role)) {
    throw new AppError(
      403,
      "You do not have access to this route",
      true,
      { code: "AUTHORIZATION_FAILED" },
    );
  }

  attachUserHeaders(req, payload.userId, payload.role);
  next();
}
