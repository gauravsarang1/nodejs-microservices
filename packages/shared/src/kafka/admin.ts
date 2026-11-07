import type { ITopicConfig } from "kafkajs";
import { createKafkaClient } from "./client";
import { logger } from "../logger/logger";

export async function ensureKafkaTopics(topics: ITopicConfig[]): Promise<void> {
  const admin = createKafkaClient("kafka-admin").admin();

  await admin.connect();

  try {
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
  } finally {
    await admin.disconnect();
  }
}
