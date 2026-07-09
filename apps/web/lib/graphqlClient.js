const graphqlUrl = process.env.NEXT_PUBLIC_GRAPHQL_URL ?? "http://localhost:4000/graphql";

export async function graphqlRequest({ query, variables, admin = false }) {
  const response = await fetch(graphqlUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(admin ? { "x-demo-role": "ADMIN" } : {})
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store"
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.errors?.length) {
    throw new Error(body.errors?.[0]?.message ?? "GraphQL request failed");
  }

  return body.data;
}
