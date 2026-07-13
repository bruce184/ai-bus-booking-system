import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes
} from "node:crypto";

export const CHECKOUT_FLOW_COOKIE = "bus_checkout_context";
export const BOOKING_FLOW_COOKIE = "bus_booking_context";

const FLOW_CONFIG = Object.freeze({
  checkout: { cookieName: CHECKOUT_FLOW_COOKIE, maxAge: 10 * 60 },
  booking: { cookieName: BOOKING_FLOW_COOKIE, maxAge: 30 * 60 }
});
const TOKEN_VERSION = "v1";
const MAX_CHECKOUT_SECONDS = 10 * 60;

function configuredSecret() {
  const secret = process.env.FLOW_CONTEXT_SECRET || process.env.JWT_SECRET;
  if (secret) {
    return secret;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("FLOW_CONTEXT_SECRET or JWT_SECRET is required");
  }
  return "local-development-only-flow-context-secret";
}

function encryptionKey(secret) {
  return createHash("sha256").update(secret).digest();
}

function additionalData(kind) {
  return Buffer.from(`bus-flow-context:${kind}:${TOKEN_VERSION}`, "utf8");
}

function validText(value, maxLength) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

export function flowCookieName(kind) {
  return FLOW_CONFIG[kind]?.cookieName || "";
}

export function normalizeFlowContext(kind, value, now = Date.now()) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  if (kind === "checkout") {
    const expiresAtMs = new Date(value.expiresAt).getTime();
    const seats = Array.isArray(value.seats)
      ? [...new Set(value.seats.map((seat) => String(seat).trim()))]
      : [];

    if (
      !validText(value.tripId, 128) ||
      !validText(value.holdToken, 512) ||
      seats.length === 0 ||
      seats.length > 10 ||
      seats.some((seat) => !validText(seat, 32)) ||
      !Number.isFinite(expiresAtMs) ||
      expiresAtMs <= now ||
      expiresAtMs > now + MAX_CHECKOUT_SECONDS * 1000
    ) {
      return null;
    }

    return {
      tripId: value.tripId.trim(),
      holdToken: value.holdToken.trim(),
      seats,
      expiresAt: new Date(expiresAtMs).toISOString()
    };
  }

  if (kind === "booking") {
    const bookingCode =
      typeof value.bookingCode === "string" ? value.bookingCode.trim().toUpperCase() : "";
    const email = typeof value.email === "string" ? value.email.trim().toLowerCase() : "";
    if (
      !/^[A-Z0-9-]{4,64}$/.test(bookingCode) ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return null;
    }
    return { bookingCode, email };
  }

  return null;
}

export function flowContextMaxAge(kind, context, now = Date.now()) {
  if (kind === "checkout") {
    const holdSeconds = Math.ceil((new Date(context.expiresAt).getTime() - now) / 1000);
    return Math.max(1, Math.min(FLOW_CONFIG.checkout.maxAge, holdSeconds));
  }
  return FLOW_CONFIG[kind]?.maxAge || 0;
}

export function flowCookieOptions(kind, context, now = Date.now()) {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: flowContextMaxAge(kind, context, now)
  };
}

export function sealFlowContext(kind, context, options = {}) {
  const now = options.now ?? Date.now();
  const secret = options.secret || configuredSecret();
  const maxAge = flowContextMaxAge(kind, context, now);
  if (!FLOW_CONFIG[kind] || maxAge <= 0) {
    throw new Error("Unsupported flow context");
  }

  const envelope = JSON.stringify({
    kind,
    expiresAt: now + maxAge * 1000,
    context
  });
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
  cipher.setAAD(additionalData(kind));
  const encrypted = Buffer.concat([cipher.update(envelope, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    TOKEN_VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url")
  ].join(".");
}

export function readFlowContext(kind, token, options = {}) {
  if (!FLOW_CONFIG[kind] || typeof token !== "string") {
    return null;
  }

  try {
    const [version, ivValue, tagValue, encryptedValue, extra] = token.split(".");
    if (version !== TOKEN_VERSION || !ivValue || !tagValue || !encryptedValue || extra) {
      return null;
    }

    const secret = options.secret || configuredSecret();
    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(secret),
      Buffer.from(ivValue, "base64url")
    );
    decipher.setAAD(additionalData(kind));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final()
    ]).toString("utf8");
    const envelope = JSON.parse(plaintext);
    const now = options.now ?? Date.now();

    if (
      envelope?.kind !== kind ||
      !Number.isFinite(envelope.expiresAt) ||
      envelope.expiresAt <= now
    ) {
      return null;
    }

    return normalizeFlowContext(kind, envelope.context, now);
  } catch {
    return null;
  }
}
