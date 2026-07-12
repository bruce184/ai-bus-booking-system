const endpoint = process.env.NEXT_PUBLIC_GRAPHQL_URL || "http://localhost:4000/graphql";

export const GRAPHQL_ENDPOINT = endpoint;

// Cookies instead of localStorage: Server Components render on the server
// and cannot see localStorage, forcing every authenticated screen onto the
// client. A cookie is sent with the request and readable server-side too
// (via next/headers), even though every read/write here still happens
// client-side - converting individual pages to Server Components is
// separate, larger follow-up work, not part of this storage-layer fix.
const TOKEN_COOKIE = "customer_token";
const USER_COOKIE = "customer_user";
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60; // matches gateway JWT_EXPIRES_IN_SECONDS default

function readCookie(name) {
  if (typeof document === "undefined") {
    return null;
  }
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name, value, maxAgeSeconds) {
  if (typeof document === "undefined") {
    return;
  }
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; samesite=lax`;
}

function deleteCookie(name) {
  if (typeof document === "undefined") {
    return;
  }
  document.cookie = `${name}=; path=/; max-age=0; samesite=lax`;
}

export function getCustomerToken() {
  return readCookie(TOKEN_COOKIE);
}

export function getCustomerUser() {
  try {
    return JSON.parse(readCookie(USER_COOKIE) || "null");
  } catch {
    return null;
  }
}

export function setCustomerSession(token, user) {
  writeCookie(TOKEN_COOKIE, token, SESSION_MAX_AGE_SECONDS);
  writeCookie(USER_COOKIE, JSON.stringify(user), SESSION_MAX_AGE_SECONDS);
}

export function clearCustomerSession() {
  deleteCookie(TOKEN_COOKIE);
  deleteCookie(USER_COOKIE);
}

export async function graphqlRequest(query, variables = {}) {
  const headers = { "content-type": "application/json" };
  const token = getCustomerToken();
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
    cache: "no-store"
  });
  const payload = await response.json();
  if (!response.ok || payload.errors?.length) {
    throw new Error(payload.errors?.[0]?.message || `GraphQL request failed with ${response.status}`);
  }
  return payload.data;
}
