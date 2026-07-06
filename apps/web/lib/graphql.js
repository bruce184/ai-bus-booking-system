const endpoint = process.env.NEXT_PUBLIC_GRAPHQL_URL || "http://localhost:4000/graphql";

export const GRAPHQL_ENDPOINT = endpoint;

export function getCustomerToken() {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem("customer_token");
}

export function getCustomerUser() {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return JSON.parse(window.localStorage.getItem("customer_user") || "null");
  } catch {
    return null;
  }
}

export function clearCustomerSession() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem("customer_token");
  window.localStorage.removeItem("customer_user");
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
