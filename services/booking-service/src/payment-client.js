import { fail } from "@bus/shared/errors.js";

const STANDARD_ERROR_CODES = new Set([
  "VALIDATION_ERROR",
  "NOT_FOUND",
  "BOOKING_STATE_INVALID",
  "PAYMENT_FAILED",
  "INTERNAL_ERROR"
]);

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
  if (typeof value === "string" && STANDARD_ERROR_CODES.has(value)) {
    return value;
  }

  return null;
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

  const response = await fetch(`${paymentServiceUrl()}/simulate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(simulatePaymentRequest({ booking, success }))
  });
  const payload = await readJson(response);

  if (!response.ok) {
    const code = normalizeErrorCode(payload.error) || "INTERNAL_ERROR";
    fail(code, payload.message || "Payment Service rejected payment simulation");
  }

  return payload;
}
