import { AppError, createProducer, publishJson, TOPICS } from "shared";

let producer: Awaited<ReturnType<typeof createProducer>> | null = null;

export async function initKafka() {
  producer = await createProducer("task-service");
}

export async function publishTaskEvent(
  taskId: string,
  userId: string,
  requestId: string,
) {
  if (!producer) {
    throw new AppError(503, "Task event producer is not initialized", true, {
      code: "KAFKA_PRODUCER_NOT_READY",
      details: { operation: "publish_task_created_event", taskId },
    });
  }

  await publishJson(
    producer,
    TOPICS.TASK_EVENTS,
    {
      eventType: "task.created",
      taskId,
      userId,
      requestId,
      message: "Task created successfully",
      timestamp: new Date().toISOString(),
    },
    taskId,
  );
}
