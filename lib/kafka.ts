import { Kafka } from "kafkajs";

const kafka = new Kafka({
  clientId: "aviation-intelligence",
  brokers: [process.env.KAFKA_BROKER!],
  ssl: true,
  sasl: {
    mechanism: "plain",
    username: process.env.KAFKA_USERNAME!,
    password: process.env.KAFKA_PASSWORD!,
  },
});

const producer = kafka.producer();

let connected = false;

export async function publishEvent(topic: string, event: any) {
  if (!connected) {
    await producer.connect();
    connected = true;
  }

  await producer.send({
    topic,
    messages: [
      {
        value: JSON.stringify(event),
      },
    ],
  });
}