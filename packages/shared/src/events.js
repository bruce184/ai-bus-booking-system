import amqp from "amqplib";
import { Kafka } from "kafkajs";

const rabbitUrl = process.env.RABBITMQ_URL || "amqp://localhost:5672";
const workflowExchange = process.env.RABBITMQ_WORKFLOW_EXCHANGE || "bus.workflow";
const kafkaBrokers = (process.env.KAFKA_BROKERS || "localhost:9092").split(",");

let rabbitChannelPromise;
let kafkaProducerPromise;

async function rabbitChannel() {
  if (!rabbitChannelPromise) {
    rabbitChannelPromise = amqp.connect(rabbitUrl).then(async (connection) => {
      const channel = await connection.createChannel();
      await channel.assertExchange(workflowExchange, "topic", { durable: true });
      return channel;
    });
  }
  return rabbitChannelPromise;
}

async function kafkaProducer() {
  if (!kafkaProducerPromise) {
    const kafka = new Kafka({
      clientId: process.env.KAFKA_CLIENT_ID || "bus-booking-module",
      brokers: kafkaBrokers
    });
    const producer = kafka.producer();
    kafkaProducerPromise = producer.connect().then(() => producer);
  }
  return kafkaProducerPromise;
}

export async function publishWorkflowEvent(eventName, payload) {
  if (process.env.DISABLE_RABBITMQ === "true") {
    console.log(`[rabbitmq:disabled] ${eventName}`, payload);
    return;
  }

  const channel = await rabbitChannel();
  channel.publish(
    workflowExchange,
    eventName,
    Buffer.from(JSON.stringify({ eventName, payload, occurredAt: new Date().toISOString() })),
    { contentType: "application/json", persistent: true }
  );
}

export async function publishKafkaEvent(topic, eventName, payload) {
  if (process.env.DISABLE_KAFKA === "true") {
    console.log(`[kafka:disabled] ${topic}:${eventName}`, payload);
    return;
  }

  const producer = await kafkaProducer();
  await producer.send({
    topic,
    messages: [
      {
        key: payload.bookingCode || payload.bookingId || eventName,
        value: JSON.stringify({ eventName, payload, occurredAt: new Date().toISOString() })
      }
    ]
  });
}

export async function createWorkflowConsumer(queueName, routingKeys, onMessage) {
  const channel = await rabbitChannel();
  const queue = await channel.assertQueue(queueName, { durable: true });

  for (const routingKey of routingKeys) {
    await channel.bindQueue(queue.queue, workflowExchange, routingKey);
  }

  await channel.consume(queue.queue, async (message) => {
    if (!message) {
      return;
    }

    try {
      const event = JSON.parse(message.content.toString("utf8"));
      await onMessage(event);
      channel.ack(message);
    } catch (error) {
      console.error(`[${queueName}] failed to process message`, error);
      channel.nack(message, false, false);
    }
  });
}
