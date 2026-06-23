import { createHmac, timingSafeEqual } from "node:crypto";

import type { GatewayConfig } from "../config/env.js";
import type { CurrentUser } from "../server/context.js";
import { findDemoUserById } from "./users.js";

type JwtPayload = {
  sub: string;
  email: string;
  role: CurrentUser["role"];
  fullName: string;
  iat: number;
  exp: number;
};

const JWT_HEADER = {
  alg: "HS256",
  typ: "JWT"
};

function base64UrlEncode(value: string | Buffer): string {
  return Buffer.from(value)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function base64UrlDecode(value: string): string {
  const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
  return Buffer.from(padded.replaceAll("-", "+").replaceAll("_", "/"), "base64").toString("utf8");
}

function signPart(value: string, secret: string): string {
  return base64UrlEncode(createHmac("sha256", secret).update(value).digest());
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function signDemoJwt(user: CurrentUser, config: GatewayConfig): { token: string; expiresAt: string } {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAtSeconds = issuedAt + config.auth.jwtExpiresInSeconds;
  const payload: JwtPayload = {
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

export function verifyDemoJwt(token: string, config: GatewayConfig): CurrentUser | null {
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

  let payload: JwtPayload;

  try {
    const header = JSON.parse(base64UrlDecode(encodedHeader)) as typeof JWT_HEADER;
    payload = JSON.parse(base64UrlDecode(encodedPayload)) as JwtPayload;

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
