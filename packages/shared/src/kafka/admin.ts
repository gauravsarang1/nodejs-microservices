import type { ITopicConfig } from "kafkajs";
import { createKafkaClient } from "./client";
import { logger } from "../logger/logger";
import { AppError } from "../errors/AppError";

export async function ensureKafkaTopics(topics: ITopicConfig[]): Promise<void> {
  const admin = createKafkaClient("kafka-admin").admin();
  let connected = false;
  let operationFailed = false;

  try {
    await admin.connect();
    connected = true;
    const existingTopics = new Set(await admin.listTopics());
    const missingTopics = topics.filter(({ topic }) => !existingTopics.has(topic));

    if (missingTopics.length > 0) {
      await admin.createTopics({
        topics: missingTopics,
        waitForLeaders: true,
      });
    }

    logger.info(
      { topics: topics.map(({ topic }) => topic) },
      "Kafka topics are ready",
    );
  } catch (cause) {
    operationFailed = true;
    throw new AppError(503, "Kafka topic initialization failed", true, {
      code: "KAFKA_TOPIC_INITIALIZATION_FAILED",
      cause,
      details: {
        topics: topics.map(({ topic }) => topic),
        operation: "ensure_topics",
      },
    });
  } finally {
    if (connected) {
      try {
        await admin.disconnect();
      } catch (cause) {
        if (operationFailed) {
          logger.error(
            { err: cause, operation: "disconnect_kafka_admin" },
            "Kafka admin disconnect failed after another error",
          );
        } else {
          throw new AppError(503, "Kafka admin disconnect failed", true, {
            code: "KAFKA_DISCONNECT_FAILED",
            cause,
            details: { operation: "disconnect_kafka_admin" },
          });
        }
      }
    }
  }
}
