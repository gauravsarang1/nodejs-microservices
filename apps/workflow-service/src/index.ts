import { config } from "dotenv";
import express from "express";
import { resolve } from "node:path";
import {
  AppError,
  configureServiceLogging,
  errorHandler,
  logger,
  successResponse,
  createRateLimiter,
  validateRequiredEnvironment,
  verifyDatabaseConnection,
} from "shared";
import { startKafka } from "./services/workflow.service";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), "../../.env") });

const httpLogger = configureServiceLogging("workflow-service");
const PORT = process.env.WORKFLOW_SERVICE_PORT || 3004;

const app = express();

//rate limiter middleware to limit the number of requests per IP address
const rateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // limit each IP to 100 requests per windowMs
  message:
    "Too many requests from this IP, please try again after 15 minutes.",
});
app.use(httpLogger);
app.use(rateLimiter);
app.use(express.json());

app.get("/health", (_req, res) => {
  successResponse(res, { service: "workflow-service" });
});

app.use((_req, _res, next) => {
  next(new AppError(404, "Route not found"));
});

app.use(errorHandler);

async function startWorkflowService() {
  validateRequiredEnvironment(["DATABASE_URL", "KAFKA_BROKERS"]);
  await verifyDatabaseConnection();
  await startKafka();
  logger.info({ dependency: "kafka" }, "Dependency initialized");

  app.listen(PORT, () => {
    logger.info({ port: PORT }, "Workflow service started");
  });
}

startWorkflowService().catch((err: unknown) => {
  logger.fatal(
    {
      err,
      operation: "service_startup",
      ...(err instanceof AppError
        ? { errorCode: err.code, ...err.details }
        : {}),
    },
    "Workflow service failed to start",
  );
  process.exit(1);
});
