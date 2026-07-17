import assert from "node:assert/strict";
import test from "node:test";
import { status as grpcStatus } from "@grpc/grpc-js";
import { businessDate, compactBusinessDate, formatDateInTimeZone } from "../src/date.js";
import { createEventEnvelope, createWorkflowConsumer } from "../src/events.js";
import { claimWorkflowEvent } from "../src/idempotency.js";
import { isServiceErrorCode, ServiceError, toGrpcError } from "../src/errors.js";
import {
  CANCELLATION_CUTOFF_HOURS,
  CANCELLATION_POLICY_TEXT,
  CANCELLATION_REFUND_PERCENT
} from "../src/policies.js";

test("workflow consumers claim an event with a consumer-specific idempotency key", async () => {
  const calls = [];
  const client = {
    async query(text, params) {
      calls.push({ text, params });
      return { rowCount: calls.length === 1 ? 1 : 0 };
    }
  };

  assert.equal(await claimWorkflowEvent(client, "ticket-worker", "event-1"), true);
  assert.equal(await claimWorkflowEvent(client, "ticket-worker", "event-1"), false);
  assert.deepEqual(calls[0].params, ["ticket-worker", "event-1"]);
});

test("business dates use Asia/Ho_Chi_Minh instead of the UTC calendar date", () => {
  const afterLocalMidnight = new Date("2026-07-13T17:30:00.000Z");

  assert.equal(formatDateInTimeZone(afterLocalMidnight), "2026-07-14");
  assert.equal(businessDate(afterLocalMidnight, 1), "2026-07-15");
  assert.equal(compactBusinessDate(afterLocalMidnight), "20260714");
});

test("createEventEnvelope preserves persisted outbox identity on retry", () => {
  const metadata = {
    eventId: "8c8f4f5e-9f2a-4c1e-9a3d-2f4f7b1a6c11",
    occurredAt: "2026-07-13T01:02:03.000Z"
  };

  const first = createEventEnvelope("booking.paid", { bookingId: "booking-1" }, metadata);
  const retry = createEventEnvelope("booking.paid", { bookingId: "booking-1" }, metadata);

  assert.deepEqual(retry, first);
  assert.equal(first.eventId, metadata.eventId);
  assert.equal(first.occurredAt, metadata.occurredAt);
});

test("createEventEnvelope generates canonical metadata for direct publishers", () => {
  const envelope = createEventEnvelope("trip.search_performed", { resultCount: 2 });

  assert.match(envelope.eventId, /^[0-9a-f-]{36}$/i);
  assert.equal(envelope.eventName, "trip.search_performed");
  assert.deepEqual(envelope.payload, { resultCount: 2 });
  assert.equal(Number.isNaN(Date.parse(envelope.occurredAt)), false);
});

test("cancellation policy constants and source text cannot drift apart", () => {
  assert.match(CANCELLATION_POLICY_TEXT, /booking dang PAID/);
  assert.match(CANCELLATION_POLICY_TEXT, new RegExp(`${CANCELLATION_CUTOFF_HOURS} gio`));
  assert.match(CANCELLATION_POLICY_TEXT, new RegExp(`${CANCELLATION_REFUND_PERCENT}%`));
  assert.match(CANCELLATION_POLICY_TEXT, /khong du dieu kien huy/);
});

test("SERVICE_TIMEOUT is a canonical service error and gRPC deadline", () => {
  assert.equal(isServiceErrorCode("SERVICE_TIMEOUT"), true);
  assert.equal(isServiceErrorCode("SOME_RANDOM_ERROR"), false);

  const grpcError = toGrpcError(new ServiceError("SERVICE_TIMEOUT", "Trip Service timed out"));
  assert.equal(grpcError.code, grpcStatus.DEADLINE_EXCEEDED);
  assert.deepEqual(grpcError.metadata.get("error-code"), ["SERVICE_TIMEOUT"]);
});


test("workflow consumer reconnects and restores durable bindings after broker close", async () => {
  class FakeEmitter {
    constructor() {
      this.listeners = new Map();
    }
    on(name, listener) {
      const listeners = this.listeners.get(name) || [];
      listeners.push(listener);
      this.listeners.set(name, listeners);
    }
    emit(name, value) {
      for (const listener of this.listeners.get(name) || []) listener(value);
    }
  }

  function fakeChannel(label) {
    const channel = new FakeEmitter();
    channel.label = label;
    channel.bindings = [];
    channel.assertExchange = async () => {};
    channel.assertQueue = async (name) => ({ queue: name });
    channel.bindQueue = async (queue, exchange, key) => {
      channel.bindings.push({ queue, exchange, key });
    };
    channel.prefetch = async (count) => {
      channel.prefetchCount = count;
    };
    channel.consume = async (queue) => {
      channel.consumedQueue = queue;
    };
    channel.ack = () => {};
    channel.nack = () => {};
    channel.close = async () => {
      channel.closed = true;
    };
    return channel;
  }

  function fakeConnection(channel) {
    const connection = new FakeEmitter();
    connection.createChannel = async () => channel;
    connection.close = async () => {
      connection.closed = true;
    };
    return connection;
  }

  const firstChannel = fakeChannel("first");
  const secondChannel = fakeChannel("second");
  const firstConnection = fakeConnection(firstChannel);
  const secondConnection = fakeConnection(secondChannel);
  const connections = [firstConnection, secondConnection];
  const scheduled = [];

  const handle = await createWorkflowConsumer(
    "booking-service.trip-completed",
    ["trip.completed"],
    async () => {},
    {
      connect: async () => connections.shift(),
      schedule: (work) => {
        scheduled.push(work);
        return scheduled.length;
      },
      cancelSchedule: () => {}
    }
  );

  assert.equal(firstChannel.consumedQueue, "booking-service.trip-completed");
  assert.equal(firstChannel.prefetchCount, 1);
  firstConnection.emit("close");
  assert.equal(scheduled.length, 1);

  await scheduled.shift()();
  assert.equal(secondChannel.consumedQueue, "booking-service.trip-completed");
  assert.deepEqual(
    secondChannel.bindings.filter(({ exchange }) => exchange === "bus.workflow"),
    [{
      queue: "booking-service.trip-completed",
      exchange: "bus.workflow",
      key: "trip.completed"
    }]
  );

  await handle.close();
  assert.equal(secondChannel.closed, true);
  assert.equal(secondConnection.closed, true);
});

test("each workflow consumer's dead-letter queue binds a unique routing key, not a catch-all", async () => {
  const channel = {
    bindings: [],
    queueArgs: {},
    on() {},
    async assertExchange() {},
    async assertQueue(name, options) {
      if (options) this.queueArgs[name] = options;
      return { queue: name };
    },
    async bindQueue(queue, exchange, key) {
      this.bindings.push({ queue, exchange, key });
    },
    async prefetch() {},
    async consume() {}
  };
  const connection = {
    on() {},
    createChannel: async () => channel
  };

  await createWorkflowConsumer(
    "ticket-worker.booking-paid",
    ["booking.paid"],
    async () => {},
    { connect: async () => connection }
  );

  const dlqBinding = channel.bindings.find(({ exchange }) => exchange === "bus.workflow.dlx");
  assert.ok(dlqBinding, "expected a binding on the dead-letter exchange");
  assert.notEqual(dlqBinding.key, "#");
  assert.equal(dlqBinding.key, "dlq.ticket-worker.booking-paid");

  const mainQueueArgs = channel.queueArgs["ticket-worker.booking-paid"];
  assert.equal(mainQueueArgs.arguments["x-dead-letter-routing-key"], dlqBinding.key);
});
