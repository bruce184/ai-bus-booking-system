import { AsyncLocalStorage } from "node:async_hooks";

// One id per end-to-end user request, threaded through gRPC metadata and
// event envelopes so logs/traces across services can be tied together
// (week02 gRPC metadata, week04 event correlationId). Async-local instead of
// an explicit parameter so existing call sites don't all need a new argument.
export const CORRELATION_METADATA_KEY = "x-correlation-id";

const storage = new AsyncLocalStorage();

export function runWithCorrelationId(correlationId, fn) {
  return storage.run({ correlationId: correlationId || null }, fn);
}

export function getCorrelationId() {
  return storage.getStore()?.correlationId ?? null;
}
