import path from "node:path";
import { fileURLToPath } from "node:url";

import { createInsecureClient, loadProto } from "@bus/shared/grpc.js";
import { fetchWithTimeout } from "@bus/shared/http.js";

export const READINESS_SEED = Object.freeze({
  tripId: "00000000-0000-4000-8004-000000000001",
  bookingCode: "BK202606240001",
  bookingEmail: "guest.anna@example.com"
});

const readinessQuery = `
  query Readiness($tripId: ID!, $bookingCode: String!, $email: String!) {
    trip(id: $tripId) {
      trip { id }
    }
    seatMap(tripId: $tripId) {
      id
    }
    bookingStatus(bookingCode: $bookingCode, email: $email) {
      bookingCode
    }
  }
`;

export const DEV_SERVICE_TARGETS = [
  { name: "Web", type: "http", url: "http://localhost:3000" },
  {
    name: "GraphQL Gateway",
    type: "graphql",
    url: "http://localhost:4000/graphql",
    query: readinessQuery,
    variables: {
      tripId: READINESS_SEED.tripId,
      bookingCode: READINESS_SEED.bookingCode,
      email: READINESS_SEED.bookingEmail
    },
    validate: (data) =>
      data?.trip?.trip?.id === READINESS_SEED.tripId
      && Array.isArray(data?.seatMap)
      && data?.bookingStatus?.bookingCode === READINESS_SEED.bookingCode
  },
  {
    name: "Trip Service",
    type: "grpc",
    address: "localhost:50051",
    proto: "trip.proto",
    servicePath: ["bus", "trip", "v1", "TripService"],
    method: "GetTripDetail",
    request: { trip_id: READINESS_SEED.tripId },
    validate: (response) => response?.trip?.id === READINESS_SEED.tripId
  },
  {
    name: "Seat Inventory Service",
    type: "grpc",
    address: "localhost:50052",
    proto: "seat_inventory.proto",
    servicePath: ["bus", "seat", "v1", "SeatInventoryService"],
    method: "GetSeatMap",
    request: { trip_id: READINESS_SEED.tripId },
    validate: (response) => Array.isArray(response?.seats)
  },
  {
    name: "Booking Service",
    type: "grpc",
    address: "localhost:50053",
    proto: "booking.proto",
    servicePath: ["bus", "booking", "v1", "BookingService"],
    method: "GetBookingStatus",
    request: {
      booking_code: READINESS_SEED.bookingCode,
      email: READINESS_SEED.bookingEmail
    },
    validate: (response) =>
      response?.booking_code === READINESS_SEED.bookingCode
  },
  {
    name: "Payment Service",
    type: "http",
    url: "http://localhost:5010/health",
    expectOk: true
  },
  {
    name: "Analytics Service",
    type: "http",
    url: "http://localhost:50056/health",
    expectOk: true
  },
  {
    name: "MCP Server",
    type: "http",
    url: "http://localhost:4010/health",
    expectOk: true
  }
];

export async function probeHttp(
  target,
  timeoutMs = 2_000,
  { request = fetchWithTimeout } = {}
) {
  const response = await request(target.url, {}, { timeoutMs });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  if (target.expectOk) {
    const payload = await response.json();
    if (payload?.ok !== true) {
      throw new Error(`${target.name} health check reported ok=false`);
    }
  }
}

export async function probeGraphql(
  target,
  timeoutMs = 2_000,
  { request = fetchWithTimeout } = {}
) {
  const response = await request(
    target.url,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        operationName: "Readiness",
        query: target.query,
        variables: target.variables
      })
    },
    { timeoutMs }
  );
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (payload?.errors?.length) {
    throw new Error("GraphQL readiness query returned errors");
  }
  if (!target.validate?.(payload?.data)) {
    throw new Error("GraphQL readiness query returned invalid demo data");
  }
}

function resolveService(proto, servicePath) {
  const service = servicePath.reduce(
    (value, segment) => value?.[segment],
    proto
  );
  if (typeof service !== "function") {
    throw new Error(`gRPC service not found: ${servicePath.join(".")}`);
  }
  return service;
}

export async function probeGrpc(
  target,
  timeoutMs = 2_000,
  {
    load = loadProto,
    createClient = createInsecureClient
  } = {}
) {
  const proto = load(target.proto);
  const client = createClient(
    resolveService(proto, target.servicePath),
    target.address
  );

  try {
    const response = await new Promise((resolve, reject) => {
      client[target.method](
        target.request,
        { deadline: Date.now() + timeoutMs },
        (error, value) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(value);
        }
      );
    });
    if (!target.validate?.(response)) {
      throw new Error(`${target.name} returned invalid demo data`);
    }
  } finally {
    client.close();
  }
}

export function probeTarget(target, timeoutMs) {
  if (target.type === "http") {
    return probeHttp(target, timeoutMs);
  }
  if (target.type === "graphql") {
    return probeGraphql(target, timeoutMs);
  }
  if (target.type === "grpc") {
    return probeGrpc(target, timeoutMs);
  }
  throw new Error(`Unsupported readiness target type: ${target.type}`);
}

export async function waitForTargets(
  targets,
  {
    timeoutMs = 120_000,
    intervalMs = 500,
    probe = probeTarget,
    onRetry = () => {}
  } = {}
) {
  const deadline = Date.now() + timeoutMs;
  let pending = targets;

  while (pending.length > 0) {
    const checks = await Promise.all(
      pending.map(async (target) => {
        try {
          await probe(target);
          return null;
        } catch {
          return target;
        }
      })
    );
    pending = checks.filter(Boolean);
    if (pending.length === 0) {
      return;
    }
    if (Date.now() >= deadline) {
      throw new Error(`Services not ready: ${pending.map((target) => target.name).join(", ")}`);
    }
    onRetry(pending);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

function printReadyBanner() {
  console.log(`
===================================================
SYSTEM IS READY FOR DEMO (semantic probes passed)
===================================================
Web App:          http://localhost:3000
GraphQL Gateway: http://localhost:4000/graphql
Admin Dashboard: http://localhost:3000/admin/login
===================================================`);
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    await waitForTargets(DEV_SERVICE_TARGETS, {
      onRetry: (pending) => console.log(`[readiness] waiting for ${pending.map((item) => item.name).join(", ")}`)
    });
    printReadyBanner();
    if (process.argv.includes("--keep-alive")) {
      setInterval(() => {}, 3_600_000);
    }
  } catch (error) {
    console.error(`[readiness] ${error.message}`);
    process.exitCode = 1;
  }
}
