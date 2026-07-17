import { fetchWithTimeout } from "@bus/shared/http.js";

// Shared with lib/server/flow-context.js's normalizeFlowContext("checkout", ...)
// validation - kept here (not the server-only file) so client components like
// SeatMap can enforce the same cap before ever creating a Redis hold.
export const MAX_CHECKOUT_SEATS = 10;

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function endpoint(kind) {
  if (kind !== "checkout" && kind !== "booking") {
    throw new Error("Unsupported flow context");
  }
  return `/api/flow-context/${kind}`;
}

export async function getFlowContext(kind) {
  const response = await fetchWithTimeout(endpoint(kind), {
    cache: "no-store",
    credentials: "same-origin"
  });
  if (response.status === 404) {
    return null;
  }
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(payload.error || "Không thể đọc phiên thao tác.");
  }
  return payload.context;
}

export async function storeFlowContext(kind, context) {
  const response = await fetchWithTimeout(endpoint(kind), {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(context)
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(payload.error || "Không thể lưu phiên thao tác.");
  }
}

export async function clearFlowContext(kind) {
  const response = await fetchWithTimeout(endpoint(kind), {
    method: "DELETE",
    credentials: "same-origin"
  });
  if (!response.ok) {
    const payload = await readJson(response);
    throw new Error(payload.error || "Không thể xóa phiên thao tác.");
  }
}
