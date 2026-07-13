export const SESSION_COOKIE = "bus_session";

const LOGIN = `
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      token
      expiresAt
      user { id email fullName role }
    }
  }
`;

const ME = `query Me { me { id email fullName role } }`;

function gatewayEndpoint() {
  return process.env.GRAPHQL_GATEWAY_URL || "http://localhost:4000/graphql";
}

export async function callGateway(query, variables = {}, token = "") {
  const headers = { "content-type": "application/json" };
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  const response = await fetch(gatewayEndpoint(), {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
    cache: "no-store"
  });
  const payload = await response.json();
  return { payload, status: response.status };
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 8 * 60 * 60
  };
}

export function roleAllowedForPortal(role, portal) {
  if (portal === "customer") {
    return role === "CUSTOMER";
  }
  if (portal === "admin") {
    return role === "ADMIN" || role === "STAFF";
  }
  return false;
}

export async function loginAtGateway(email, password) {
  return callGateway(LOGIN, { input: { email, password } });
}

export async function readGatewaySession(token) {
  return callGateway(ME, {}, token);
}
