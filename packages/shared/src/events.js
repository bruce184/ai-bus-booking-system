import { randomUUID } from "node:crypto";
import amqp from "amqplib";
import { Kafka } from "kafkajs";

const rabbitUrl = process.env.RABBITMQ_URL || "amqp://localhost:5672";
const workflowExchange = process.env.RABBITMQ_WORKFLOW_EXCHANGE || "bus.workflow";
const workflowDeadLetterExchange = `${workflowExchange}.dlx`;
const kafkaBrokers = (process.env.KAFKA_BROKERS || "localhost:9092").split(",");

let rabbitChannelPromise;
let kafkaProducerPromise;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectWithRetry(url, retries = 30, delay = 2500) {
  for (let i = 0; i < retries; i++) {
    try {
      return await amqp.connect(url);
    } catch (err) {
      console.warn(`[RabbitMQ] Connection attempt ${i + 1}/${retries} failed: ${err.message}. Retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
  throw new Error(`Failed to connect to RabbitMQ at ${url} after ${retries} attempts.`);
}

function clearRabbitPublisher(channelPromise) {
  if (rabbitChannelPromise === channelPromise) {
    rabbitChannelPromise = null;
  }
}

async function rabbitChannel() {
  if (!rabbitChannelPromise) {
    let channelPromise;
    channelPromise = (async () => {
      const connection = await connectWithRetry(rabbitUrl);
      connection.on("error", (err) => {
        console.error("[RabbitMQ] Connection error", err);
      });
      connection.on("close", () => {
        console.warn("[RabbitMQ] Connection closed");
        clearRabbitPublisher(channelPromise);
      });

      const channel = await connection.createConfirmChannel();
      channel.on("error", (err) => {
        console.error("[RabbitMQ] Channel error", err);
      });
      channel.on("close", () => {
        console.warn("[RabbitMQ] Channel closed");
        clearRabbitPublisher(channelPromise);
      });
      await channel.assertExchange(workflowExchange, "topic", { durable: true });
      await channel.assertExchange(workflowDeadLetterExchange, "topic", { durable: true });
      return channel;
    })().catch((error) => {
      clearRabbitPublisher(channelPromise);
      throw error;
    });
    rabbitChannelPromise = channelPromise;
  }
  return rabbitChannelPromise;
}

export function createEventEnvelope(eventName, payload, metadata = {}) {
  return {
    eventId: metadata.eventId || randomUUID(),
    eventName,
    payload,
    occurredAt: metadata.occurredAt || new Date().toISOString()
  };
}

async function kafkaProducer() {
  if (!kafkaProducerPromise) {
    const kafka = new Kafka({
      clientId: process.env.KAFKA_CLIENT_ID || "bus-booking-module",
      brokers: kafkaBrokers
    });
    const producer = kafka.producer();
    kafkaProducerPromise = producer.connect()
      .then(() => producer)
      .catch((error) => {
        kafkaProducerPromise = null;
        throw error;
      });
  }
  return kafkaProducerPromise;
}

export async function publishWorkflowEvent(eventName, payload, metadata = {}) {
  const envelope = createEventEnvelope(eventName, payload, metadata);
  if (process.env.DISABLE_RABBITMQ === "true") {
    console.log(`[rabbitmq:disabled] ${eventName}`, envelope);
    return;
  }

  const channel = await rabbitChannel();
  try {
    await new Promise((resolve, reject) => {
      channel.publish(
        workflowExchange,
        metadata.routingKey || eventName,
        Buffer.from(JSON.stringify(envelope)),
        { contentType: "application/json", persistent: true },
        (error) => (error ? reject(error) : resolve())
      );
    });
  } catch (error) {
    // Do not retain a publisher that failed a confirm. The outbox keeps the
    // row unpublished and the next dispatch builds a fresh channel.
    rabbitChannelPromise = null;
    await channel.close().catch(() => {});
    throw error;
  }
}

export async function publishKafkaEvent(topic, eventName, payload, metadata = {}) {
  const envelope = createEventEnvelope(eventName, payload, metadata);
  if (process.env.DISABLE_KAFKA === "true") {
    console.log(`[kafka:disabled] ${topic}:${eventName}`, envelope);
    return;
  }

  const producer = await kafkaProducer();
  try {
    await producer.send({
      topic,
      messages: [
        {
          key: payload.bookingCode || payload.bookingId || eventName,
          value: JSON.stringify(envelope)
        }
      ]
    });
  } catch (error) {
    // A failed producer must not poison the module-level promise forever.
    kafkaProducerPromise = null;
    await producer.disconnect().catch(() => {});
    throw error;
  }
}

async function configureWorkflowConsumer(channel, queueName, routingKeys, onMessage) {
  const deadLetterQueueName = `${queueName}.dlq`;
  await channel.assertExchange(workflowExchange, "topic", { durable: true });
  await channel.assertExchange(workflowDeadLetterExchange, "topic", { durable: true });
  await channel.assertQueue(deadLetterQueueName, { durable: true });
  await channel.bindQueue(deadLetterQueueName, workflowDeadLetterExchange, "#");

  const queue = await channel.assertQueue(queueName, {
    durable: true,
    arguments: { "x-dead-letter-exchange": workflowDeadLetterExchange }
  });
  for (const routingKey of routingKeys) {
    await channel.bindQueue(queue.queue, workflowExchange, routingKey);
  }

  await channel.prefetch(1);
  await channel.consume(queue.queue, async (message) => {
    if (!message) return;

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

// Consumers use dedicated connections because a publisher-channel reconnect
// cannot restore broker subscriptions. The returned handle is optional for
// current runtimes, but allows graceful shutdown in long-lived processes.
export async function createWorkflowConsumer(
  queueName,
  routingKeys,
  onMessage,
  {
    connect = () => connectWithRetry(rabbitUrl),
    reconnectDelayMs = 1000,
    schedule = (work, delay) => setTimeout(work, delay),
    cancelSchedule = (timer) => clearTimeout(timer)
  } = {}
) {
  let stopped = false;
  let connection = null;
  let channel = null;
  let reconnectTimer = null;
  let connectingPromise = null;

  const scheduleReconnect = () => {
    if (stopped || reconnectTimer || connectingPromise) return;
    reconnectTimer = schedule(async () => {
      reconnectTimer = null;
      try {
        await ensureConnected();
      } catch (error) {
        console.error(`[${queueName}] RabbitMQ reconnect failed`, error);
        scheduleReconnect();
      }
    }, reconnectDelayMs);
  };

  const connectConsumer = async () => {
    const nextConnection = await connect();
    const nextChannel = await nextConnection.createChannel();
    let active = true;
    const recover = () => {
      if (!active || stopped) return;
      active = false;
      scheduleReconnect();
    };

    nextConnection.on("error", (error) => {
      console.error(`[${queueName}] RabbitMQ connection error`, error);
    });
    nextConnection.on("close", recover);
    nextChannel.on("error", (error) => {
      console.error(`[${queueName}] RabbitMQ channel error`, error);
    });
    nextChannel.on("close", recover);

    try {
      await configureWorkflowConsumer(nextChannel, queueName, routingKeys, onMessage);
    } catch (error) {
      active = false;
      await nextChannel.close().catch(() => {});
      await nextConnection.close().catch(() => {});
      throw error;
    }

    connection = nextConnection;
    channel = nextChannel;
  };

  const ensureConnected = async () => {
    if (connectingPromise) return connectingPromise;
    connectingPromise = connectConsumer().finally(() => {
      connectingPromise = null;
    });
    return connectingPromise;
  };

  await ensureConnected();
  return {
    close: async () => {
      stopped = true;
      if (reconnectTimer) {
        cancelSchedule(reconnectTimer);
        reconnectTimer = null;
      }
      const currentChannel = channel;
      const currentConnection = connection;
      channel = null;
      connection = null;
      await currentChannel?.close().catch(() => {});
      await currentConnection?.close().catch(() => {});
    }
  };
}
