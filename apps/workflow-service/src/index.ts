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
import { startKafka } from "./services/workflow.service";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), "../../.env") });

const PORT = process.env.WORKFLOW_SERVICE_PORT || 3004;

const app = express();

app.use(httpLogger);
app.use(express.json());

app.get("/health", (_req, res) => {
  successResponse(res, { service: "workflow-service" });
});

app.use((_req, _res, next) => {
  next(new AppError(404, "Route not found"));
});

app.use(errorHandler);

startKafka()
  .then(() => {
    logger.info("Kafka initialized successfully");
    app.listen(PORT, () => {
      logger.info(`Workflow service is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    logger.error("Failed to initialize Kafka", err);
    process.exit(1);
  });


