import { config } from "dotenv";
import { resolve } from "node:path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit, { MINUTE } from "express-rate-limit";
import {
  AppError,
  errorHandler,
  httpLogger,
  logger,
  successResponse,
} from "shared";
import { createProxyMiddleware } from "http-proxy-middleware";
import { gatewayAuth } from "./middleware/gatewayAuth";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), "../../.env") });

const PORT = process.env.API_GATEWAY_PORT || 3000;
const AUTH_SERVICE_URL =
  process.env.AUTH_SERVICE_URL || "http://localhost:3001";

const app = express();

//secure default http headers
app.use(helmet());
app.use(cors());
app.use(
  rateLimit({
    windowMs: 15 * MINUTE, // SECOND, MINUTE, HOUR, and DAY constants are available, or a use bare number for milliseconds
    limit: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes).
    standardHeaders: true, // draft-6: `RateLimit-*` headers; draft-7 & draft-8: combined `RateLimit` header
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
  }),
);

app.use(httpLogger);

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
  createProxyMiddleware({
    target: AUTH_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path) => `/auth${path}`,
  }),
);

// task proxy -> :3000/tasks/* gateway forwards to :3002/tasks*
// localhost:3000/tasks/list -> forward this req -> localhost:3002/tasks/list
app.use(
  "/tasks",
  gatewayAuth,
  createProxyMiddleware({
    target: process.env.TASK_SERVICE_URL || "http://localhost:3002",
    changeOrigin: true,
    pathRewrite: (path) => `/tasks${path}`,
  }),
);

// media proxy -> :3000/media/* gateway forwards to :3003/media*
// localhost:3000/media/list -> forward this req -> localhost:3003/media/list
app.use(
  "/media",
  gatewayAuth,
  createProxyMiddleware({
    target: process.env.MEDIA_SERVICE_URL || "http://localhost:3003",
    changeOrigin: true,
    pathRewrite: (path) => `/media${path}`,
  }),
);

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`API gateway running on port ${PORT}`);
});
