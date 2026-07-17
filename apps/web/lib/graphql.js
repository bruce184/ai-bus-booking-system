import { fetchWithTimeout } from "@bus/shared/http.js";

export const GRAPHQL_ENDPOINT = "/api/graphql";

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    throw new Error(`Request failed with HTTP ${response.status}`);
  }
}

export async function graphqlRequest(query, variables = {}) {
  const response = await fetchWithTimeout(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
    cache: "no-store"
  });
  const payload = await readJson(response);
  if (!response.ok || payload.errors?.length) {
    throw new Error(payload.errors?.[0]?.message || `GraphQL request failed with HTTP ${response.status}`);
  }
  return payload.data;
}

export async function loginSession({ email, password, portal }) {
  const response = await fetchWithTimeout("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, portal })
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(payload.error || "Login failed");
  }
  return payload.user;
}

export async function getSession() {
  const response = await fetchWithTimeout("/api/auth/session", { cache: "no-store" });
  const payload = await readJson(response);
  if (response.status === 401) {
    return null;
  }
  if (!response.ok) {
    throw new Error(payload.error || "Unable to verify session");
  }
  return payload.user;
}

export async function clearSession() {
  await fetchWithTimeout("/api/auth/session", { method: "DELETE" });
}
