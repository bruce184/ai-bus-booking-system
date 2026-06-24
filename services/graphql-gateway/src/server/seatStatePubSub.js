import { EventEmitter } from "node:events";

const emitter = new EventEmitter();
emitter.setMaxListeners(100);

function topicForTrip(tripId) {
  return `seatStateChanged:${tripId}`;
}

export function publishSeatStateChanged(tripId, seats) {
  const topic = topicForTrip(tripId);

  seats.forEach((seat) => {
    emitter.emit(topic, { seatStateChanged: seat });
  });
}

export function subscribeSeatStateChanged(tripId) {
  const topic = topicForTrip(tripId);
  const queue = [];
  let pendingResolve = null;
  let active = true;

  const onSeatStateChanged = (payload) => {
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

  emitter.on(topic, onSeatStateChanged);

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
      emitter.off(topic, onSeatStateChanged);

      if (pendingResolve) {
        pendingResolve({ value: undefined, done: true });
        pendingResolve = null;
      }

      return { value: undefined, done: true };
    },

    async throw(error) {
      active = false;
      emitter.off(topic, onSeatStateChanged);
      throw error;
    },

    [Symbol.asyncIterator]() {
      return this;
    }
  };
}
