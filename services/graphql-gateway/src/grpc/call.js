import { status as grpcStatus } from "@grpc/grpc-js";
import { gatewayError } from "../auth/errors.js";

const STANDARD_ERROR_CODES = new Set([
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "SEAT_NOT_AVAILABLE",
  "HOLD_EXPIRED",
  "BOOKING_STATE_INVALID",
  "PAYMENT_FAILED",
  "SERVICE_TIMEOUT",
  "INTERNAL_ERROR"
]);

const DEFAULT_CALL_TIMEOUT_MS = Number(process.env.GRPC_CALL_TIMEOUT_MS || 5000);
const CIRCUIT_FAILURE_THRESHOLD = Number(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD || 5);
const CIRCUIT_COOLDOWN_MS = Number(process.env.CIRCUIT_BREAKER_COOLDOWN_MS || 10_000);

// One breaker per downstream gRPC client (trip/booking/seatInventory), not
// per method or per call: a service being down affects every RPC on it.
// closed -> (N consecutive connectivity failures) -> open -> (cooldown
// elapses) -> half-open -> (next call succeeds/fails) -> closed/open.
const breakers = new WeakMap();

function getBreaker(client) {
  let breaker = breakers.get(client);
  if (!breaker) {
    breaker = { state: "closed", failures: 0, openedAt: 0 };
    breakers.set(client, breaker);
  }
  return breaker;
}

// Only a genuinely unreachable/unresponsive downstream trips the breaker.
// A business-logic rejection (NOT_FOUND, VALIDATION_ERROR, ...) means the
// service answered, so it counts as the service being up.
function isConnectivityFailure(code) {
  return code === grpcStatus.UNAVAILABLE || code === grpcStatus.DEADLINE_EXCEEDED;
}

function recordFailure(breaker, failureThreshold) {
  breaker.failures += 1;
  if (breaker.state === "half-open" || breaker.failures >= failureThreshold) {
    breaker.state = "open";
    breaker.openedAt = Date.now();
  }
}

function recordSuccess(breaker) {
  breaker.state = "closed";
  breaker.failures = 0;
}

function normalizeErrorCode(value) {
  if (typeof value === "string" && STANDARD_ERROR_CODES.has(value)) {
    return value;
  }

  return null;
}

function readMetadataErrorCode(error) {
  const values = error.metadata?.get?.("error-code") || [];

  for (const value of values) {
    const code = normalizeErrorCode(Buffer.isBuffer(value) ? value.toString("utf8") : value);

    if (code) {
      return code;
    }
  }

  return null;
}

function readPrefixedErrorCode(error) {
  const details = error.details || error.message || "";
  const [prefix] = details.split(":", 1);

  return normalizeErrorCode(prefix);
}

function mapGrpcErrorCode(error) {
  const explicitCode = readMetadataErrorCode(error) || readPrefixedErrorCode(error);

  if (explicitCode) {
    return explicitCode;
  }

  switch (error.code) {
    case grpcStatus.INVALID_ARGUMENT:
      return "VALIDATION_ERROR";
    case grpcStatus.UNAUTHENTICATED:
      return "UNAUTHORIZED";
    case grpcStatus.PERMISSION_DENIED:
      return "FORBIDDEN";
    case grpcStatus.NOT_FOUND:
      return "NOT_FOUND";
    case grpcStatus.DEADLINE_EXCEEDED:
      return "SERVICE_TIMEOUT";
    default:
      return "INTERNAL_ERROR";
  }
}

// async so every failure path (including the fail-fast throw below) is a
// rejected promise, never a synchronous throw - a consistent contract for
// callers awaiting this like any other async call.
export async function callGrpc(
  client,
  methodName,
  request,
  {
    timeoutMs = DEFAULT_CALL_TIMEOUT_MS,
    circuitFailureThreshold = CIRCUIT_FAILURE_THRESHOLD,
    circuitCooldownMs = CIRCUIT_COOLDOWN_MS
  } = {}
) {
  const method = client[methodName];

  if (typeof method !== "function") {
    throw gatewayError(`gRPC method ${methodName} is not available.`, "INTERNAL_ERROR");
  }

  const breaker = getBreaker(client);
  if (breaker.state === "open") {
    if (Date.now() - breaker.openedAt < circuitCooldownMs) {
      // Fail fast without even attempting the call, so a downed service
      // can't queue up requests against the gateway (Week 3 slide 30/32).
      throw gatewayError("Downstream service is temporarily unavailable.", "SERVICE_TIMEOUT");
    }
    breaker.state = "half-open";
  }

  // Deadline so a hung downstream service fails fast instead of blocking the gateway.
  const options = { deadline: new Date(Date.now() + timeoutMs) };

  return new Promise((resolve, reject) => {
    method.call(client, request, options, (error, response) => {
      if (error) {
        if (isConnectivityFailure(error.code)) {
          recordFailure(breaker, circuitFailureThreshold);
        } else {
          recordSuccess(breaker);
        }
        reject(gatewayError(error.details || error.message, mapGrpcErrorCode(error)));
        return;
      }

      recordSuccess(breaker);
      resolve(response);
    });
  });
}
