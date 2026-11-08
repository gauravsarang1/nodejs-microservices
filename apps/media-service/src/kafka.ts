import { AppError, createProducer, publishJson, TOPICS } from "shared";

let producer: Awaited<ReturnType<typeof createProducer>> | null = null;

export async function initKafka() {
  producer = await createProducer("media-service");
}

export async function publishAttachmentEvent(
  taskId: string,
  attachmentId: string,
  userId: string,
  requestId: string,
) {
  if (!producer) {
    throw new AppError(503, "Attachment event producer is not initialized", true, {
      code: "KAFKA_PRODUCER_NOT_READY",
      details: {
        operation: "publish_attachment_event",
        taskId,
        attachmentId,
      },
    });
  }

  await publishJson(
    producer,
    TOPICS.MEDIA_EVENTS,
    {
      eventType: "attachment.uploaded",
      taskId,
      attachmentId,
      userId,
      requestId,
      message: "Attachment uploaded",
      timestamp: new Date().toISOString(),
    },
    taskId,
  );
}
