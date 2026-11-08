import type { Consumer, EachMessagePayload } from "kafkajs";
import { createKafkaClient } from "./client";
import { logger } from "../logger/logger";
import { AppError } from "../errors/AppError";

export async function createConsumer(
  clientId: string,
  groupId: string,
): Promise<Consumer> {
  const kafka = createKafkaClient(clientId);

  const consumer = kafka.consumer({ groupId });

  try {
    await consumer.connect();
  } catch (cause) {
    throw new AppError(503, "Kafka consumer connection failed", true, {
      code: "KAFKA_UNAVAILABLE",
      cause,
      details: { clientId, groupId, operation: "connect_consumer" },
    });
  }

  logger.info({ clientId, groupId }, "kafka consumer connected");

  return consumer;
}

// subscribe to the topic names
// start a poll
// call business handler for every/each message

// runconsumer(consumer, [topic1, topic2, topic3], async({message})=> insert task workflows)

export async function runConsumer(
  consumer: Consumer,
  topics: string[],
  handler: (payload: EachMessagePayload) => Promise<void>,
  options?: { fromBeginning?: boolean },
): Promise<void> {
  try {
    await consumer.subscribe({
      topics,
      fromBeginning: options?.fromBeginning ?? false,
    });

    await consumer.run({
      eachMessage: async (payload) => {
        const { topic, partition, message } = payload;
        const eventType = getEventType(message.value?.toString());

        logger.info(
          {
            topic,
            partition,
            offset: message.offset,
            eventType,
          },
          "Kafka message received",
        );

        try {
          await handler(payload);
        } catch (cause) {
          logger.error(
            {
              err: cause,
              topic,
              partition,
              offset: message.offset,
              eventType,
            },
            "Kafka message processing failed",
          );
          throw cause;
        }
      },
    });
  } catch (cause) {
    throw new AppError(503, "Kafka consumer startup failed", true, {
      code: "KAFKA_CONSUMER_START_FAILED",
      cause,
      details: { topics, operation: "subscribe_and_run" },
    });
  }
}

function getEventType(value: string | undefined): string {
  if (!value) {
    return "empty";
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "eventType" in parsed &&
      typeof parsed.eventType === "string"
    ) {
      return parsed.eventType;
    }
  } catch {
    return "invalid_json";
  }

  return "unknown";
}
