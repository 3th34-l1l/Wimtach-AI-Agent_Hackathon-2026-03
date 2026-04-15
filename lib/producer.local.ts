import fs from "node:fs";
import path from "node:path";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Kafka = require("node-rdkafka");

const TOPIC_FALLBACK = "aviation.ai.review";
const SASL_MECHANISM = process.env.KAFKA_SASL_MECHANISM || "SCRAM-SHA-256";
const BROKER = process.env.KAFKA_BROKER;
const USERNAME = process.env.KAFKA_USERNAME;
const PASSWORD = process.env.KAFKA_PASSWORD;

const CA_PATH =
  process.env.KAFKA_CA_PATH || path.join(process.cwd(), "certs", "ca.pem");

if (!BROKER) throw new Error("Missing KAFKA_BROKER");
if (!USERNAME) throw new Error("Missing KAFKA_USERNAME");
if (!PASSWORD) throw new Error("Missing KAFKA_PASSWORD");
if (!fs.existsSync(CA_PATH)) {
  throw new Error(`Kafka CA file not found at ${CA_PATH}`);
}

type RdkafkaProducer = {
  on: (event: string, cb: (...args: any[]) => void) => void;
  connect: () => void;
  isConnected?: () => boolean;
  produce: (
    topic: string,
    partition: number | null,
    message: Buffer,
    key: string | null,
    timestamp: number
  ) => void;
  poll: () => void;
};

let producer: RdkafkaProducer | null = null;
let connectPromise: Promise<void> | null = null;
let isReady = false;

function createProducer(): RdkafkaProducer {
  return new Kafka.Producer({
    "metadata.broker.list": BROKER,
    "security.protocol": "sasl_ssl",
    "sasl.mechanism": SASL_MECHANISM,
    "sasl.username": USERNAME,
    "sasl.password": PASSWORD,
    "ssl.ca.location": CA_PATH,
    "dr_cb": true,
  });
}

export async function connectProducer(): Promise<void> {
  if (isReady && producer) return;
  if (connectPromise) return connectPromise;

  producer = createProducer();

  connectPromise = new Promise<void>((resolve, reject) => {
    const handleReady = () => {
      isReady = true;
      console.log("✅ Kafka producer ready");
      resolve();
    };

    const handleError = (err: Error) => {
      console.error("❌ Kafka producer error", err);
      connectPromise = null;
      reject(err);
    };

    producer!.on("ready", handleReady);
    producer!.on("event.error", handleError);

    producer!.connect();
  });

  return connectPromise;
}

export async function publishEvent(topic: string, event: unknown): Promise<void> {
  await connectProducer();

  if (!producer) {
    throw new Error("Kafka producer not initialized");
  }

  const payload = Buffer.from(JSON.stringify(event));
  const finalTopic = topic || TOPIC_FALLBACK;

  producer.produce(finalTopic, null, payload, null, Date.now());
  producer.poll();

  console.log(`📡 Published Kafka event to ${finalTopic}`);
}