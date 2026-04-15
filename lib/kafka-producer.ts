import { Kafka } from "kafkajs";

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    throw new Error(`Missing ${name}`);
  }
  return val;
}

const kafka = new Kafka({
  clientId: "aviation-intelligence",
  brokers: [requireEnv("KAFKA_BROKER")],
  ssl: true,
  sasl: {
    mechanism: "plain",
    username: requireEnv("KAFKA_USERNAME"),
    password: requireEnv("KAFKA_PASSWORD"),
  },
});

const producer = kafka.producer();

let connected = false;
let connectPromise: Promise<void> | null = null;

export async function connectProducer(): Promise<void> {
  if (connected) return;
  if (connectPromise) return connectPromise;

  connectPromise = (async () => {
    await producer.connect();
    connected = true;
    console.log("✅ Kafka connected");
  })();

  try {
    await connectPromise;
  } catch (err) {
    connectPromise = null;
    connected = false;
    throw err;
  }
}

export async function publishEvent(topic: string, event: unknown): Promise<void> {
  await connectProducer();

  await producer.send({
    topic,
    messages: [
      {
        value: JSON.stringify(event),
      },
    ],
  });

  console.log(`📡 Event sent to Kafka: ${topic}`);
}