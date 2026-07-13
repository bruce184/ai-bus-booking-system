import { fetchWithTimeout } from "@bus/shared/http.js";

import { config } from "./config.js";

export async function graphqlRequest({ query, variables, admin = false, url = config.graphqlUrl }) {
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(admin ? { "x-demo-role": "ADMIN" } : {})
    },
    body: JSON.stringify({ query, variables })
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.errors?.length) {
    const message = body.errors?.[0]?.message ?? "GraphQL request failed";
    const error = new Error(message);
    error.extensions = body.errors?.[0]?.extensions;
    throw error;
  }

  return body.data;
}
