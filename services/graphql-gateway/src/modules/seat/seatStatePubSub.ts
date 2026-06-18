import { EventEmitter } from "node:events";
import type { Seat } from "./seatTypes.js";

type SeatStateChangedPayload = {
  seatStateChanged: Seat;
};

const emitter = new EventEmitter();
emitter.setMaxListeners(100);

function topicForTrip(tripId: string): string {
  return `seatStateChanged:${tripId}`;
}

export function publishSeatStateChanged(tripId: string, seats: Seat[]): void {
  const topic = topicForTrip(tripId);

  seats.forEach((seat) => {
    emitter.emit(topic, { seatStateChanged: seat });
  });
}

export function subscribeSeatStateChanged(
  tripId: string
): AsyncIterableIterator<SeatStateChangedPayload> {
  const topic = topicForTrip(tripId);
  const queue: SeatStateChangedPayload[] = [];
  let pendingResolve: ((value: IteratorResult<SeatStateChangedPayload>) => void) | null = null;
  let active = true;

  const onSeatStateChanged = (payload: SeatStateChangedPayload): void => {
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
    async next(): Promise<IteratorResult<SeatStateChangedPayload>> {
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

    async return(): Promise<IteratorResult<SeatStateChangedPayload>> {
      active = false;
      emitter.off(topic, onSeatStateChanged);

      if (pendingResolve) {
        pendingResolve({ value: undefined, done: true });
        pendingResolve = null;
      }

      return { value: undefined, done: true };
    },

    async throw(error?: unknown): Promise<IteratorResult<SeatStateChangedPayload>> {
      active = false;
      emitter.off(topic, onSeatStateChanged);
      throw error;
    },

    [Symbol.asyncIterator](): AsyncIterableIterator<SeatStateChangedPayload> {
      return this;
    }
  };
}
