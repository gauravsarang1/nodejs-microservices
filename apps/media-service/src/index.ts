import { config } from "dotenv";
import express from "express";
import { resolve } from "node:path";
import {
  AppError,
  errorHandler,
  httpLogger,
  logger,
  requireGatewaySecret,
  successResponse,
} from "shared";
import { initKafka } from "./kafka";
import attachmentRoutes from "./routes/media.routes";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), "../../.env") });

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

initKafka()
  .then(() => {
    logger.info("Kafka initialized successfully");
    app.listen(PORT, () => {
      logger.info(`Media service is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    logger.error("Failed to initialize Kafka", err);
    process.exit(1);
  });
