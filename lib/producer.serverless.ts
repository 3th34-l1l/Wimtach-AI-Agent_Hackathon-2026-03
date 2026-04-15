import { Kafka, type Producer, type SASLOptions } from "kafkajs";

const TOPIC_FALLBACK = "aviation.ai.review";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

const SASL_MECHANISM = (
  process.env.KAFKA_SASL_MECHANISM || "scram-sha-256"
).toLowerCase();

const BROKER = requireEnv("KAFKA_BROKER");
const USERNAME = requireEnv("KAFKA_USERNAME");
const PASSWORD = requireEnv("KAFKA_PASSWORD");
const CA_CERT = requireEnv("KAFKA_CA");

function getSaslConfig(): SASLOptions {
  switch (SASL_MECHANISM) {
    case "plain":
      return {
        mechanism: "plain",
        username: USERNAME,
        password: PASSWORD,
      };

    case "scram-sha-256":
      return {
        mechanism: "scram-sha-256",
        username: USERNAME,
        password: PASSWORD,
      };

    case "scram-sha-512":
      return {
        mechanism: "scram-sha-512",
        username: USERNAME,
        password: PASSWORD,
      };

    default:
      throw new Error(`Unsupported KAFKA_SASL_MECHANISM: ${SASL_MECHANISM}`);
  }
}

const kafka = new Kafka({
  clientId: "aviation-intelligence-serverless",
  brokers: [BROKER],
  ssl: {
    ca: [CA_CERT],
    rejectUnauthorized: true,
  },
  sasl: getSaslConfig(),
});

let producer: Producer | null = null;
let connectPromise: Promise<void> | null = null;
let isReady = false;

function getProducer(): Producer {
  if (!producer) {
    producer = kafka.producer({
      allowAutoTopicCreation: false,
    });
  }

  return producer;
}

export async function connectProducer(): Promise<void> {
  if (isReady) return;
  if (connectPromise) return connectPromise;

  const activeProducer = getProducer();

  connectPromise = (async () => {
    await activeProducer.connect();
    isReady = true;
    console.log("✅ KafkaJS producer ready");
  })();

  try {
    await connectPromise;
  } catch (err) {
    connectPromise = null;
    isReady = false;
    throw err;
  }
}

export async function publishEvent(topic: string, event: unknown): Promise<void> {
  await connectProducer();

  const activeProducer = getProducer();
  const finalTopic = topic || TOPIC_FALLBACK;

  await activeProducer.send({
    topic: finalTopic,
    messages: [
      {
        value: JSON.stringify(event),
        timestamp: String(Date.now()),
      },
    ],
  });

  console.log(`📡 Published Kafka event to ${finalTopic}`);
}