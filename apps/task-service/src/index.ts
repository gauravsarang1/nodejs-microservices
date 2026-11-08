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
import taskRoutes from "./routes/task.routes";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), "../../.env") });

const httpLogger = configureServiceLogging("task-service");
const PORT = process.env.TASK_SERVICE_PORT || 3002;

const app = express();

app.use(httpLogger);
app.use(express.json());

app.get("/health", (_req, res) => {
  successResponse(res, { service: "task-service" });
});

// mount routes here

app.use("/tasks", requireGatewaySecret, taskRoutes);

app.use((_req, _res, next) => {
  next(new AppError(404, "Route not found"));
});

app.use(errorHandler);

async function startTaskService() {
  validateRequiredEnvironment([
    "DATABASE_URL",
    "GATEWAY_SECRET",
    "KAFKA_BROKERS",
  ]);
  await verifyDatabaseConnection();
  await initKafka();
  logger.info({ dependency: "kafka" }, "Dependency initialized");

  app.listen(PORT, () => {
    logger.info({ port: PORT }, "Task service started");
  });
}

startTaskService().catch((err: unknown) => {
  logger.fatal(
    {
      err,
      operation: "service_startup",
      ...(err instanceof AppError
        ? { errorCode: err.code, ...err.details }
        : {}),
    },
    "Task service failed to start",
  );
  process.exit(1);
});
