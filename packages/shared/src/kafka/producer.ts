import type { Producer, RecordMetadata } from "kafkajs";
import { createKafkaClient } from "./client";
import { logger } from "../logger/logger";
import { AppError } from "../errors/AppError";

export async function createProducer(clientId: string): Promise<Producer> {
  const kafka = createKafkaClient(clientId);

  // responsible for sending records/data to the kafka topics
  const producer = kafka.producer();

  try {
    await producer.connect();
  } catch (cause) {
    throw new AppError(503, "Kafka producer connection failed", true, {
      code: "KAFKA_UNAVAILABLE",
      cause,
      details: { clientId, operation: "connect_producer" },
    });
  }

  logger.info({ clientId }, "kafka producer connected");

  return producer;
}

export async function publishJson(
  producer: Producer,
  topic: string,
  payload: Record<string, unknown>,
  key?: string,
): Promise<RecordMetadata[]> {
  let value: string;

  try {
    value = JSON.stringify(payload);
    if (typeof value !== "string") {
      throw new TypeError("Kafka event must serialize to a JSON string");
    }
  } catch (cause) {
    throw new AppError(500, "Kafka event serialization failed", false, {
      code: "KAFKA_SERIALIZATION_FAILED",
      cause,
      details: { topic, operation: "serialize_event" },
    });
  }

  try {
    const result = await producer.send({
      topic,
      messages: [
        {
          key: key ?? null,
          value,
        },
      ],
    });

    logger.info(
      {
        topic,
        eventType:
          typeof payload.eventType === "string" ? payload.eventType : "unknown",
        requestId:
          typeof payload.requestId === "string" ? payload.requestId : undefined,
      },
      "Kafka event published",
    );
    return result;
  } catch (cause) {
    throw new AppError(503, "Kafka event publishing failed", true, {
      code: "KAFKA_PUBLISH_FAILED",
      cause,
      details: { topic, operation: "publish_event" },
    });
  }
}
