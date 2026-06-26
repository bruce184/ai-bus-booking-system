const endpoint = process.env.NEXT_PUBLIC_GRAPHQL_URL || "http://localhost:4000/graphql";

export async function graphqlRequest(query, variables = {}) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
    cache: "no-store"
  });
  const payload = await response.json();
  if (!response.ok || payload.errors?.length) {
    throw new Error(payload.errors?.[0]?.message || `GraphQL request failed with ${response.status}`);
  }
  return payload.data;
}
