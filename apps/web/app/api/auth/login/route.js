import { NextResponse } from "next/server";

import {
  SESSION_COOKIE,
  loginAtGateway,
  roleAllowedForPortal,
  sessionCookieOptions
} from "../../../../lib/server/gateway";

export async function POST(request) {
  let input;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = String(input.email || "").trim();
  const password = String(input.password || "");
  const portal = input.portal;
  if (!email || !password || !["customer", "admin"].includes(portal)) {
    return NextResponse.json({ error: "email, password and portal are required" }, { status: 400 });
  }

  try {
    const { payload, status } = await loginAtGateway(email, password);
    if (payload.errors?.length || !payload.data?.login) {
      return NextResponse.json(
        { error: payload.errors?.[0]?.message || "Login failed" },
        { status: status >= 400 ? status : 401 }
      );
    }

    const { token, user } = payload.data.login;
    if (!roleAllowedForPortal(user.role, portal)) {
      return NextResponse.json({ error: "This account cannot access the selected portal" }, { status: 403 });
    }

    const response = NextResponse.json({ user });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  } catch (error) {
    console.error("Login gateway request failed:", error);
    return NextResponse.json({ error: "Authentication service is unavailable" }, { status: 503 });
  }
}
