import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const gatewayRoot = fileURLToPath(new URL("../..", import.meta.url));
const gatewayPort = 4100;
const gatewayUrl = `http://127.0.0.1:${gatewayPort}/graphql`;
const startupTimeoutMs = 10_000;

let gatewayProcess;
let gatewayOutput = "";

function appendOutput(chunk) {
  gatewayOutput += chunk.toString();
}

async function graphqlRequest({ query, variables, token }) {
  const response = await fetch(gatewayUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ query, variables })
  });

  const body = await response.json();

  return {
    status: response.status,
    body
  };
}

async function waitForGateway() {
  const deadline = Date.now() + startupTimeoutMs;

  while (Date.now() < deadline) {
    try {
      const result = await graphqlRequest({ query: "{ me { id } }" });

      if (result.status === 200) {
        return;
      }
    } catch {
      // Gateway is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`GraphQL Gateway did not start within ${startupTimeoutMs}ms.\n${gatewayOutput}`);
}

async function login(email, password) {
  const result = await graphqlRequest({
    query: `
      mutation Login($input: LoginInput!) {
        login(input: $input) {
          token
          user {
            id
            email
            role
          }
        }
      }
    `,
    variables: {
      input: {
        email,
        password
      }
    }
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.errors, undefined);
  assert.ok(result.body.data.login.token);

  return result.body.data.login;
}

test.before(async () => {
  gatewayProcess = spawn(process.execPath, ["src/index.js"], {
    cwd: gatewayRoot,
    env: {
      ...process.env,
      GRAPHQL_GATEWAY_PORT: String(gatewayPort),
      JWT_SECRET: "integration_test_secret_change_me_1234567890"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  gatewayProcess.stdout.on("data", appendOutput);
  gatewayProcess.stderr.on("data", appendOutput);

  gatewayProcess.once("exit", (code, signal) => {
    if (code !== 0 && signal !== "SIGTERM") {
      gatewayOutput += `\nGateway exited early with code ${code} and signal ${signal}.`;
    }
  });

  await waitForGateway();
});

test.after(async () => {
  if (!gatewayProcess || gatewayProcess.killed) {
    return;
  }

  await new Promise((resolve) => {
    gatewayProcess.once("exit", resolve);
    gatewayProcess.kill("SIGTERM");
    setTimeout(resolve, 2_000);
  });
});

test("login and me work through the real GraphQL HTTP gateway", async () => {
  const loginResult = await login("admin@example.com", "admin123");

  assert.equal(loginResult.user.id, "demo-admin");
  assert.equal(loginResult.user.role, "ADMIN");

  const meResult = await graphqlRequest({
    query: "{ me { id email role } }",
    token: loginResult.token
  });

  assert.equal(meResult.status, 200);
  assert.equal(meResult.body.errors, undefined);
  assert.deepEqual(meResult.body.data.me, {
    id: "demo-admin",
    email: "admin@example.com",
    role: "ADMIN"
  });
});

test("admin analytics enforces authentication and admin role over HTTP", async () => {
  const analyticsQuery = `
    query AdminDashboard($input: AdminRevenueSummaryInput!) {
      adminAnalyticsDashboard(input: $input) {
        revenueSummary {
          totalRevenue
          paidBookings
          ticketsSold
        }
        dailyRevenue {
          date
          revenue
        }
      }
    }
  `;
  const variables = {
    input: {
      from: "2026-06-18",
      to: "2026-06-24"
    }
  };

  const unauthenticated = await graphqlRequest({ query: analyticsQuery, variables });

  assert.equal(unauthenticated.status, 200);
  assert.equal(unauthenticated.body.errors[0].extensions.code, "UNAUTHORIZED");

  const customer = await login("customer@example.com", "customer123");
  const forbidden = await graphqlRequest({
    query: analyticsQuery,
    variables,
    token: customer.token
  });

  assert.equal(forbidden.status, 200);
  assert.equal(forbidden.body.errors[0].extensions.code, "FORBIDDEN");

  const admin = await login("admin@example.com", "admin123");
  const allowed = await graphqlRequest({
    query: analyticsQuery,
    variables,
    token: admin.token
  });

  assert.equal(allowed.status, 200);
  assert.equal(allowed.body.errors, undefined);
  assert.equal(allowed.body.data.adminAnalyticsDashboard.revenueSummary.totalRevenue, 1_860_000);
  assert.ok(allowed.body.data.adminAnalyticsDashboard.dailyRevenue.length >= 1);
});

// When SEAT_INVENTORY_URL is not set, the gateway cannot reach the gRPC service.
// The gateway must translate the connection failure into a GraphQL INTERNAL_ERROR.
// When SEAT_INVENTORY_URL is set, the gateway reaches the real service and returns data.
const SEAT_INVENTORY_URL = process.env.SEAT_INVENTORY_URL;

test("seatMap returns INTERNAL_ERROR when seat inventory service is unreachable", {
  skip: !!SEAT_INVENTORY_URL
    ? "Seat inventory service is running — skipping the unavailability test"
    : false
}, async () => {
  // Business rule: gateway must never expose raw gRPC errors to clients.
  // An unreachable downstream service must surface as INTERNAL_ERROR.
  const result = await graphqlRequest({
    query: `
      query SeatMap($tripId: ID!) {
        seatMap(tripId: $tripId) {
          id
          status
        }
      }
    `,
    variables: {
      tripId: "00000000-0000-4000-8004-000000000001"
    }
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.data, null);
  assert.equal(result.body.errors[0].extensions.code, "INTERNAL_ERROR");
});

test("seatMap returns seat array when seat inventory service is available", {
  skip: !SEAT_INVENTORY_URL
    ? "Set SEAT_INVENTORY_URL=<host:port> to run this test against a live seat service"
    : false
}, async () => {
  // Business rule: gateway must proxy the gRPC seat map to GraphQL clients.
  // Expects the real seeded trip from database/seed.sql.
  const result = await graphqlRequest({
    query: `
      query SeatMap($tripId: ID!) {
        seatMap(tripId: $tripId) {
          id
          label
          status
        }
      }
    `,
    variables: {
      tripId: "00000000-0000-4000-8004-000000000001"
    }
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.errors, undefined);
  assert.ok(Array.isArray(result.body.data.seatMap));
  assert.ok(result.body.data.seatMap.length > 0);
  // Every seat must have the required fields
  for (const seat of result.body.data.seatMap) {
    assert.ok(seat.id);
    assert.ok(seat.label);
    assert.ok(["AVAILABLE", "HELD", "BOOKED", "BLOCKED"].includes(seat.status));
  }
});

// This test requires a live seat inventory service seeded with the race-test trip.
// Run: docker compose up -d && node services/seat-inventory-service/src/server.js
// Then: SEAT_INVENTORY_URL=localhost:50053 npm run test:gateway:integration
test("gateway proxies holdSeats and releaseSeatHold through to the seat inventory service", {
  skip: !SEAT_INVENTORY_URL
    ? "Set SEAT_INVENTORY_URL=<host:port> to run this test against a live seat service"
    : false
}, async () => {
  // Business rule: gateway must correctly relay hold/release operations to
  // seat-inventory-service via gRPC. The seat state must change atomically.
  // Requires: race-hold-test trip seeded by scripts/race-hold-test.mjs
  const tripId = "33333333-3333-3333-3333-333333333333";
  const seatId = "R01";

  // 1. Query Seat Map
  const mapResult = await graphqlRequest({
    query: `
      query SeatMap($tripId: ID!) {
        seatMap(tripId: $tripId) {
          id
          label
          status
        }
      }
    `,
    variables: { tripId }
  });

  assert.equal(mapResult.status, 200);
  assert.equal(mapResult.body.errors, undefined);
  const seats = mapResult.body.data.seatMap;
  assert.ok(Array.isArray(seats));
  const testSeat = seats.find((s) => s.label === seatId);
  assert.ok(testSeat);
  assert.equal(testSeat.status, "AVAILABLE");

  // 2. Hold Seat
  const holdResult = await graphqlRequest({
    query: `
      mutation HoldSeats($input: HoldSeatsInput!) {
        holdSeats(input: $input) {
          holdToken
          tripId
          expiresAt
          seats {
            id
            label
            status
          }
        }
      }
    `,
    variables: {
      input: {
        tripId,
        seatIds: [testSeat.id]
      }
    }
  });

  assert.equal(holdResult.status, 200);
  assert.equal(holdResult.body.errors, undefined);
  const hold = holdResult.body.data.holdSeats;
  assert.ok(hold.holdToken);
  assert.equal(hold.tripId, tripId);
  const heldSeat = hold.seats.find((s) => s.label === seatId);
  assert.ok(heldSeat);
  assert.equal(heldSeat.status, "HELD");

  // 3. Release Hold
  const releaseResult = await graphqlRequest({
    query: `
      mutation ReleaseSeatHold($input: ReleaseSeatHoldInput!) {
        releaseSeatHold(input: $input)
      }
    `,
    variables: {
      input: {
        holdToken: hold.holdToken
      }
    }
  });

  assert.equal(releaseResult.status, 200);
  assert.equal(releaseResult.body.errors, undefined);
  assert.equal(releaseResult.body.data.releaseSeatHold, true);
});
