import { createHmac, timingSafeEqual } from "node:crypto";
import { findDemoUserById } from "./users.js";

const JWT_HEADER = {
  alg: "HS256",
  typ: "JWT"
};

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function base64UrlDecode(value) {
  const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
  return Buffer.from(padded.replaceAll("-", "+").replaceAll("_", "/"), "base64").toString("utf8");
}

function signPart(value, secret) {
  return base64UrlEncode(createHmac("sha256", secret).update(value).digest());
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function signDemoJwt(user, config) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAtSeconds = issuedAt + config.auth.jwtExpiresInSeconds;
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    fullName: user.fullName,
    iat: issuedAt,
    exp: expiresAtSeconds
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(JWT_HEADER));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const signature = signPart(unsignedToken, config.auth.jwtSecret);

  return {
    token: `${unsignedToken}.${signature}`,
    expiresAt: new Date(expiresAtSeconds * 1000).toISOString()
  };
}

export function verifyDemoJwt(token, config) {
  const tokenParts = token.split(".");

  if (tokenParts.length !== 3) {
    return null;
  }

  const [encodedHeader, encodedPayload, signature] = tokenParts;

  if (!encodedHeader || !encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signPart(`${encodedHeader}.${encodedPayload}`, config.auth.jwtSecret);

  if (!safeEqual(signature, expectedSignature)) {
    return null;
  }

  let payload;

  try {
    const header = JSON.parse(base64UrlDecode(encodedHeader));
    payload = JSON.parse(base64UrlDecode(encodedPayload));

    if (header.alg !== JWT_HEADER.alg || header.typ !== JWT_HEADER.typ) {
      return null;
    }
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);

  if (!payload.sub || payload.exp <= now) {
    return null;
  }

  const user = findDemoUserById(payload.sub);

  if (!user || user.email !== payload.email || user.role !== payload.role) {
    return null;
  }

  return user;
}
