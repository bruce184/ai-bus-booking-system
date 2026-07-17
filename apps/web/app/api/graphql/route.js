import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { callGateway, SESSION_COOKIE } from "../../../lib/server/gateway";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ errors: [{ message: "Invalid JSON body" }] }, { status: 400 });
  }

  if (typeof body.query !== "string") {
    return NextResponse.json({ errors: [{ message: "GraphQL query is required" }] }, { status: 400 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value || "";
  try {
    const { payload, status } = await callGateway(body.query, body.variables || {}, token);
    const response = NextResponse.json(payload, { status });
    response.headers.set("cache-control", "no-store");

    const unauthorized = payload.errors?.some(
      (error) => error.extensions?.code === "UNAUTHORIZED"
    );
    if (unauthorized) {
      response.cookies.delete(SESSION_COOKIE);
    }
    return response;
  } catch (error) {
    console.error("GraphQL gateway proxy failed:", error);
    return NextResponse.json(
      { errors: [{ message: "GraphQL gateway is unavailable" }] },
      { status: 503 }
    );
  }
}
