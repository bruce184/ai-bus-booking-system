export const DEFAULT_HTTP_TIMEOUT_MS = 5_000;
export const MIN_HTTP_TIMEOUT_MS = 100;
export const MAX_HTTP_TIMEOUT_MS = 120_000;

function configuredTimeoutValue() {
  if (typeof process === "undefined") {
    return undefined;
  }
  return process.env?.HTTP_REQUEST_TIMEOUT_MS;
}

export function httpTimeoutMs(
  value = configuredTimeoutValue(),
  fallback = DEFAULT_HTTP_TIMEOUT_MS
) {
  const normalizedFallback = Number.isInteger(fallback)
    ? Math.min(MAX_HTTP_TIMEOUT_MS, Math.max(MIN_HTTP_TIMEOUT_MS, fallback))
    : DEFAULT_HTTP_TIMEOUT_MS;
  const parsed = Number(value);
  if (
    !Number.isInteger(parsed) ||
    parsed < MIN_HTTP_TIMEOUT_MS ||
    parsed > MAX_HTTP_TIMEOUT_MS
  ) {
    return normalizedFallback;
  }
  return parsed;
}

export function withHttpDeadline(init = {}, timeoutMs = httpTimeoutMs()) {
  const deadline = AbortSignal.timeout(httpTimeoutMs(timeoutMs));
  const signal = init.signal
    ? AbortSignal.any([init.signal, deadline])
    : deadline;
  return { ...init, signal };
}

export function fetchWithTimeout(
  input,
  init = {},
  { timeoutMs = httpTimeoutMs(), fetchImpl = globalThis.fetch } = {}
) {
  if (typeof fetchImpl !== "function") {
    throw new TypeError("A fetch implementation is required");
  }
  return fetchImpl(input, withHttpDeadline(init, timeoutMs));
}
