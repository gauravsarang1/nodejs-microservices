import { config } from "dotenv";
import express from "express";
import { resolve } from "node:path";
import {
  AppError,
  configureServiceLogging,
  errorHandler,
  logger,
  requireGatewaySecret,
  successResponse,
  validateRequiredEnvironment,
  verifyDatabaseConnection,
} from "shared";
import authRoutes from "./routes/auth.routes";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), "../../.env") });

const httpLogger = configureServiceLogging("auth-service");
const PORT = process.env.AUTH_SERVICE_PORT || 3001;

const app = express();

app.use(httpLogger);
app.use(express.json());

app.get("/health", (_req, res) => {
  successResponse(res, { service: "auth-service" });
});

app.use("/auth", requireGatewaySecret, authRoutes);

app.use((_req, _res, next) => {
  next(new AppError(404, "Route not found"));
});

app.use(errorHandler);

async function startAuthService() {
  validateRequiredEnvironment(["DATABASE_URL", "JWT_SECRET", "GATEWAY_SECRET"]);
  await verifyDatabaseConnection();

  app.listen(PORT, () => {
    logger.info({ port: PORT }, "Auth service started");
  });
}

startAuthService().catch((err: unknown) => {
  logger.fatal(
    {
      err,
      operation: "service_startup",
      ...(err instanceof AppError
        ? { errorCode: err.code, ...err.details }
        : {}),
    },
    "Auth service failed to start",
  );
  process.exit(1);
});
