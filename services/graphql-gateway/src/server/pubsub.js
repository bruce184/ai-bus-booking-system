import { EventEmitter } from "node:events";

// Single-instance, in-memory pubsub shared by all gateway subscriptions.
const emitter = new EventEmitter();
emitter.setMaxListeners(100);

export function publishToTopic(topic, payload) {
  emitter.emit(topic, payload);
}

export function subscribeToTopic(topic) {
  const queue = [];
  let pendingResolve = null;
  let active = true;

  const onEvent = (payload) => {
    if (!active) {
      return;
    }

    if (pendingResolve) {
      pendingResolve({ value: payload, done: false });
      pendingResolve = null;
      return;
    }

    queue.push(payload);
  };

  emitter.on(topic, onEvent);

  return {
    async next() {
      if (!active) {
        return { value: undefined, done: true };
      }

      const queued = queue.shift();

      if (queued) {
        return { value: queued, done: false };
      }

      return new Promise((resolve) => {
        pendingResolve = resolve;
      });
    },

    async return() {
      active = false;
      emitter.off(topic, onEvent);

      if (pendingResolve) {
        pendingResolve({ value: undefined, done: true });
        pendingResolve = null;
      }

      return { value: undefined, done: true };
    },

    async throw(error) {
      active = false;
      emitter.off(topic, onEvent);
      throw error;
    },

    [Symbol.asyncIterator]() {
      return this;
    }
  };
}
