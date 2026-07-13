import { fail, isServiceErrorCode } from "@bus/shared/errors.js";
const PAYMENT_SERVICE_TIMEOUT_MS = 10_000;

export function paymentServiceUrl(env = process.env) {
  const configured =
    env.PAYMENT_SERVICE_URL ||
    env.PAYMENT_SERVICE_BASE_URL ||
    `http://localhost:${env.PAYMENT_SERVICE_PORT || 5010}`;

  return configured.replace(/\/+$/, "");
}

export function simulatePaymentRequest({ booking, success }) {
  return {
    bookingId: booking.id,
    bookingCode: booking.booking_code,
    tripId: booking.trip_id,
    amount: Number(booking.total_amount || 0),
    success: Boolean(success)
  };
}

function normalizeErrorCode(value) {
  if (isServiceErrorCode(value)) {
    return value;
  }

  return null;
}

export function paymentTransportError(error) {
  if (error?.name === "TimeoutError") {
    return {
      code: "SERVICE_TIMEOUT",
      message: "Payment Service timed out during booking settlement"
    };
  }

  return {
    code: "INTERNAL_ERROR",
    message: "Payment Service is unavailable during booking settlement"
  };
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export async function simulatePaymentWithService({ booking, success }) {
  if (process.env.SKIP_PAYMENT_SERVICE === "true") {
    console.warn("[booking-service] SKIP_PAYMENT_SERVICE=true, not calling Payment Service");
    return {
      bookingCode: booking.booking_code,
      success: Boolean(success)
    };
  }

  let response;
  try {
    response = await fetch(`${paymentServiceUrl()}/simulate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(simulatePaymentRequest({ booking, success })),
      signal: AbortSignal.timeout(PAYMENT_SERVICE_TIMEOUT_MS)
    });
  } catch (error) {
    const transportError = paymentTransportError(error);
    fail(transportError.code, transportError.message);
  }
  const payload = await readJson(response);

  if (!response.ok) {
    const code = normalizeErrorCode(payload.error) || "INTERNAL_ERROR";
    fail(code, payload.message || "Payment Service rejected payment simulation");
  }

  return payload;
}
