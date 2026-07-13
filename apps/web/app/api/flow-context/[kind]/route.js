import { NextResponse } from "next/server";

import {
  flowCookieName,
  flowCookieOptions,
  normalizeFlowContext,
  readFlowContext,
  sealFlowContext
} from "../../../../lib/server/flow-context";

function sameOrigin(request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return false;
  }

  const origin = request.headers.get("origin");
  if (!origin) {
    return true;
  }

  try {
    const requestUrl = new URL(request.url);
    const forwardedHost = request.headers.get("x-forwarded-host");
    const forwardedProto = request.headers.get("x-forwarded-proto");
    const acceptedOrigins = new Set([requestUrl.origin]);
    if (forwardedHost) {
      acceptedOrigins.add(`${forwardedProto || requestUrl.protocol.slice(0, -1)}://${forwardedHost}`);
    }
    return acceptedOrigins.has(new URL(origin).origin);
  } catch {
    return false;
  }
}

async function readKind(params) {
  const resolved = await params;
  return resolved.kind;
}

function clearCookie(response, cookieName) {
  response.cookies.set(cookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
  return response;
}

export async function GET(request, { params }) {
  const kind = await readKind(params);
  const cookieName = flowCookieName(kind);
  if (!cookieName) {
    return NextResponse.json({ error: "Unsupported flow context" }, { status: 404 });
  }

  const context = readFlowContext(kind, request.cookies.get(cookieName)?.value);
  if (!context) {
    return clearCookie(
      NextResponse.json({ error: "Flow context is missing or expired" }, { status: 404 }),
      cookieName
    );
  }

  const response = NextResponse.json({ context });
  response.headers.set("cache-control", "no-store");
  return response;
}

export async function POST(request, { params }) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
  }

  const kind = await readKind(params);
  const cookieName = flowCookieName(kind);
  if (!cookieName) {
    return NextResponse.json({ error: "Unsupported flow context" }, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const context = normalizeFlowContext(kind, body);
  if (!context) {
    return NextResponse.json({ error: "Invalid flow context" }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true });
  response.headers.set("cache-control", "no-store");
  response.cookies.set(
    cookieName,
    sealFlowContext(kind, context),
    flowCookieOptions(kind, context)
  );
  return response;
}

export async function DELETE(request, { params }) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
  }

  const kind = await readKind(params);
  const cookieName = flowCookieName(kind);
  if (!cookieName) {
    return NextResponse.json({ error: "Unsupported flow context" }, { status: 404 });
  }

  return clearCookie(NextResponse.json({ ok: true }), cookieName);
}
