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
import { initKafka } from "./kafka";
import attachmentRoutes from "./routes/media.routes";
import { validateStorageConfiguration } from "./utils/stroage";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), "../../.env") });

const httpLogger = configureServiceLogging("media-service");
const PORT = process.env.MEDIA_SERVICE_PORT || 3003;

const app = express();

app.use(httpLogger);

app.get("/health", (_req, res) => {
  successResponse(res, { service: "media-service" });
});

app.use("/media", requireGatewaySecret, attachmentRoutes);

app.use((_req, _res, next) => {
  next(new AppError(404, "Route not found"));
});

app.use(errorHandler);

async function startMediaService() {
  validateRequiredEnvironment([
    "DATABASE_URL",
    "GATEWAY_SECRET",
    "KAFKA_BROKERS",
    "AWS_ENDPOINT_URL_S3",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_REGION",
    "STORAGE_BUCKET",
  ]);
  validateStorageConfiguration();
  await verifyDatabaseConnection();
  await initKafka();
  logger.info({ dependency: "kafka" }, "Dependency initialized");

  app.listen(PORT, () => {
    logger.info({ port: PORT }, "Media service started");
  });
}

startMediaService().catch((err: unknown) => {
  logger.fatal(
    {
      err,
      operation: "service_startup",
      ...(err instanceof AppError
        ? { errorCode: err.code, ...err.details }
        : {}),
    },
    "Media service failed to start",
  );
  process.exit(1);
});
