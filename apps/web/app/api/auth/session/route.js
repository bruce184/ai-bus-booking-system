import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { readGatewaySession, SESSION_COOKIE } from "../../../../lib/server/gateway";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  try {
    const { payload } = await readGatewaySession(token);
    const user = payload.data?.me;
    if (!user || payload.errors?.length) {
      const response = NextResponse.json({ user: null }, { status: 401 });
      response.cookies.delete(SESSION_COOKIE);
      return response;
    }
    return NextResponse.json({ user });
  } catch (error) {
    console.error("Session gateway request failed:", error);
    return NextResponse.json({ error: "Authentication service is unavailable" }, { status: 503 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ cleared: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
