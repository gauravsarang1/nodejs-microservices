import { config } from "dotenv";
import { ServerResponse } from "node:http";
import { resolve } from "node:path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import {
  AppError,
  configureServiceLogging,
  errorHandler,
  logger,
  successResponse,
  createRateLimiter,
  validateRequiredEnvironment,
} from "shared";
import { createProxyMiddleware } from "http-proxy-middleware";
import { gatewayAuth } from "./middleware/gatewayAuth";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), "../../.env") });

const httpLogger = configureServiceLogging("api-gateway");
const PORT = process.env.API_GATEWAY_PORT || 3000;
const AUTH_SERVICE_URL =
  process.env.AUTH_SERVICE_URL || "http://localhost:3001";

function createServiceProxy(target: string, upstream: string, prefix: string) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: (path) => `${prefix}${path}`,
    on: {
      proxyReq(proxyReq, req) {
        proxyReq.setHeader("x-request-id", String(req.id));
      },
      error(error, req, res) {
        const requestId = String(req.id);

        logger.error(
          {
            err: error,
            requestId,
            method: req.method,
            path: req.url?.split("?")[0] || "/",
            upstream,
            operation: "proxy_request",
            statusCode: 502,
            errorCode: "UPSTREAM_UNAVAILABLE",
          },
          "Upstream service request failed",
        );

        if (!(res instanceof ServerResponse)) {
          res.destroy(error);
          return;
        }

        if (res.headersSent) {
          res.destroy(error);
          return;
        }

        const message = "Upstream service is unavailable";
        res.statusCode = 502;
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.setHeader("x-request-id", requestId);
        res.end(
          JSON.stringify({
            success: false,
            message,
            error: {
              code: "UPSTREAM_UNAVAILABLE",
              message,
              requestId,
            },
          }),
        );
      },
    },
  });
}

const app = express();

//secure default http headers
app.use(helmet());
app.use(cors());

//rate limiter middleware to limit the number of requests per IP address
const rateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // limit each IP to 100 requests per windowMs
});
app.use(httpLogger);
app.use(rateLimiter);

app.use("/health", (_req, res) => {
  successResponse(res, { service: "api-gateway" });
});

// create proxy starts
// auth proxy -> :3000/auth/* gateway forwards to :3001/auth*
// localhost:3000/auth/login -> forward this req -> localhost:3001/auth/login

// auth proxy is protected by gatewayAuth middleware, which checks for the presence of the x-gateway-secret header in the request. If the header is missing or invalid, the request will be rejected with a 401 Unauthorized response.
app.use(
  "/auth",
  gatewayAuth,
  createServiceProxy(AUTH_SERVICE_URL, "auth-service", "/auth"),
);

// task proxy -> :3000/tasks/* gateway forwards to :3002/tasks*
// localhost:3000/tasks/list -> forward this req -> localhost:3002/tasks/list
app.use(
  "/tasks",
  gatewayAuth,
  createServiceProxy(
    process.env.TASK_SERVICE_URL || "http://localhost:3002",
    "task-service",
    "/tasks",
  ),
);

// media proxy -> :3000/media/* gateway forwards to :3003/media*
// localhost:3000/media/list -> forward this req -> localhost:3003/media/list
app.use(
  "/media",
  gatewayAuth,
  createServiceProxy(
    process.env.MEDIA_SERVICE_URL || "http://localhost:3003",
    "media-service",
    "/media",
  ),
);

app.use(errorHandler);

async function startGateway() {
  validateRequiredEnvironment(["JWT_SECRET", "GATEWAY_SECRET"]);

  app.listen(PORT, () => {
    logger.info({ port: PORT }, "API gateway started");
  });
}

startGateway().catch((err: unknown) => {
  logger.fatal(
    {
      err,
      operation: "service_startup",
      ...(err instanceof AppError
        ? { errorCode: err.code, ...err.details }
        : {}),
    },
    "API gateway failed to start",
  );
  process.exit(1);
});
