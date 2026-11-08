import {
  AppError,
  createConsumer,
  ensureKafkaTopics,
  logger,
  runConsumer,
  TOPICS,
} from "shared";
import { DomainEvent } from "../utils/types";
import * as worflowRepo from "../repository/workflow.repositories";
import { convertToPublicWorkflow } from "../utils/workflow.utils";

async function handleDomainEvent(rawData: DomainEvent) {
  const workflow = await worflowRepo.createWorkflow({
    taskId: rawData.taskId,
    eventType: rawData.eventType,
    message: rawData.message || rawData.eventType,
    createdBy: rawData.userId,
  });

  logger.info(
    {
      workflowId: workflow.id,
      eventType: workflow.event_type,
      taskId: workflow.task_id,
      requestId: rawData.requestId,
    },
    "workflow row created",
  );
}

function isDomainEvent(value: unknown): value is DomainEvent {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return (
    "eventType" in value &&
    typeof value.eventType === "string" &&
    value.eventType.length > 0 &&
    "taskId" in value &&
    typeof value.taskId === "string" &&
    value.taskId.length > 0 &&
    "userId" in value &&
    typeof value.userId === "string" &&
    value.userId.length > 0 &&
    (!("message" in value) || typeof value.message === "string") &&
    (!("requestId" in value) || typeof value.requestId === "string") &&
    (!("attachmentId" in value) || typeof value.attachmentId === "string")
  );
}

export async function startKafka() {
  await ensureKafkaTopics([
    {
      topic: TOPICS.TASK_EVENTS,
      numPartitions: 3,
      replicationFactor: 1,
    },
    {
      topic: TOPICS.MEDIA_EVENTS,
      numPartitions: 3,
      replicationFactor: 1,
    },
  ]);

  const consumer = await createConsumer(
    "workflow-service",
    "workflow-service-group",
  );

  await runConsumer(
    consumer,
    [TOPICS.TASK_EVENTS, TOPICS.MEDIA_EVENTS],
    async ({ message, topic, partition }) => {
      const value = message.value?.toString();
      if (!value) {
        logger.warn(
          { topic, partition, offset: message.offset },
          "Empty Kafka message skipped",
        );
        return;
      }

      let rawData: unknown;
      try {
        rawData = JSON.parse(value);
      } catch {
        logger.warn(
          {
            topic,
            partition,
            offset: message.offset,
            reason: "invalid_json",
          },
          "Invalid Kafka JSON message skipped",
        );
        return;
      }

      if (!isDomainEvent(rawData)) {
        logger.warn(
          {
            topic,
            partition,
            offset: message.offset,
            reason: "invalid_event_shape",
          },
          "Invalid Kafka event skipped",
        );
        return;
      }

      await handleDomainEvent(rawData);
    },
  );
}

export async function listWorkflowsByTask(
  taskId: string,
  userId: string,
  role: string,
) {
  const task = await worflowRepo.findTaskOwner(taskId);

  if (!task) {
    throw new AppError(404, "Task not found", true, {
      code: "TASK_NOT_FOUND",
      details: { taskId },
    });
  }

  if (role !== "ADMIN" && task.created_by !== userId) {
    throw new AppError(403, "You cannot access this task workflow", true, {
      code: "TASK_WORKFLOW_ACCESS_DENIED",
      details: { taskId },
    });
  }

  const rows = await worflowRepo.listWorkflowsByTaskId(taskId);

  return rows.map(convertToPublicWorkflow);
}
