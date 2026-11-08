import { Kafka, logLevel, type KafkaConfig } from "kafkajs";
import { AppError } from "../errors/AppError";

export function createKafkaClient(
  clientId: string,
  config: Partial<KafkaConfig> = {},
) {
  const brokers = (process.env.KAFKA_BROKERS || "localhost:9092")
    .split(",")
    .map((broker) => broker.trim())
    .filter((broker) => broker.length > 0);

  if (brokers.length === 0) {
    throw new AppError(500, "Kafka broker configuration is empty", false, {
      code: "CONFIGURATION_INVALID",
      details: { key: "KAFKA_BROKERS" },
    });
  }

  return new Kafka({
    clientId,
    brokers,
    logLevel: logLevel.ERROR,
    retry: {
      retries: 8,
    },
    ...config,
  });
}
