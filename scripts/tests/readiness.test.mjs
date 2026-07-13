import assert from "node:assert/strict";
import test from "node:test";

import {
  DEV_SERVICE_TARGETS,
  probeGraphql,
  probeGrpc,
  probeHttp,
  waitForTargets
} from "../wait-for-services.mjs";

test("configured readiness uses semantic probes instead of open TCP ports", () => {
  assert.equal(
    DEV_SERVICE_TARGETS.some((target) => target.type === "tcp"),
    false
  );
  assert.equal(
    DEV_SERVICE_TARGETS.find((target) => target.name === "GraphQL Gateway")?.type,
    "graphql"
  );
  assert.equal(
    DEV_SERVICE_TARGETS.filter((target) => target.type === "grpc").length,
    3
  );
});

test("HTTP readiness rejects non-success and unhealthy JSON responses", async () => {
  await assert.rejects(
    probeHttp(
      { name: "missing", url: "http://example.test" },
      100,
      { request: async () => new Response(null, { status: 404 }) }
    ),
    /HTTP 404/
  );

  await assert.rejects(
    probeHttp(
      { name: "worker", url: "http://example.test", expectOk: true },
      100,
      {
        request: async () => new Response(
          JSON.stringify({ ok: false }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        )
      }
    ),
    /ok=false/
  );
});

test("GraphQL readiness rejects HTTP 200 responses with resolver errors", async () => {
  const target = DEV_SERVICE_TARGETS.find(
    (item) => item.name === "GraphQL Gateway"
  );

  await assert.rejects(
    probeGraphql(target, 100, {
      request: async () => new Response(
        JSON.stringify({ errors: [{ message: "Booking Service unavailable" }] }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      )
    }),
    /returned errors/
  );
});

test("GraphQL readiness validates the deterministic demo contract", async () => {
  const target = DEV_SERVICE_TARGETS.find(
    (item) => item.name === "GraphQL Gateway"
  );

  await probeGraphql(target, 100, {
    request: async () => new Response(
      JSON.stringify({
        data: {
          trip: { trip: { id: target.variables.tripId } },
          seatMap: [],
          bookingStatus: { bookingCode: target.variables.bookingCode }
        }
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" }
      }
    )
  });
});

test("gRPC readiness uses a deadline, validates data, and closes its client", async () => {
  const target = DEV_SERVICE_TARGETS.find(
    (item) => item.name === "Trip Service"
  );
  let closed = false;
  let deadline = 0;
  function TripService() {}

  await probeGrpc(target, 100, {
    load: () => ({
      bus: { trip: { v1: { TripService } } }
    }),
    createClient: (ServiceCtor, address) => {
      assert.equal(ServiceCtor, TripService);
      assert.equal(address, target.address);
      return {
        GetTripDetail(request, options, callback) {
          assert.deepEqual(request, target.request);
          deadline = options.deadline;
          callback(null, { trip: { id: target.request.trip_id } });
        },
        close() {
          closed = true;
        }
      };
    }
  });

  assert.ok(deadline > Date.now());
  assert.equal(closed, true);
});

test("gRPC readiness closes its client after a business failure", async () => {
  const target = DEV_SERVICE_TARGETS.find(
    (item) => item.name === "Booking Service"
  );
  let closed = false;
  function BookingService() {}

  await assert.rejects(
    probeGrpc(target, 100, {
      load: () => ({
        bus: { booking: { v1: { BookingService } } }
      }),
      createClient: () => ({
        GetBookingStatus(_request, _options, callback) {
          callback(new Error("booking not found"));
        },
        close() {
          closed = true;
        }
      })
    }),
    /booking not found/
  );
  assert.equal(closed, true);
});

test("readiness waits until every configured target passes its probe", async () => {
  const attempts = new Map();
  const targets = [{ name: "web" }, { name: "gateway" }];

  await waitForTargets(targets, {
    timeoutMs: 100,
    intervalMs: 1,
    probe: async (target) => {
      const count = (attempts.get(target.name) || 0) + 1;
      attempts.set(target.name, count);
      if (target.name === "gateway" && count < 2) {
        throw new Error("not ready");
      }
    }
  });

  assert.equal(attempts.get("web"), 1);
  assert.equal(attempts.get("gateway"), 2);
});

test("readiness reports the exact services that never become ready", async () => {
  await assert.rejects(
    waitForTargets([{ name: "Booking Service" }], {
      timeoutMs: 0,
      intervalMs: 0,
      probe: async () => { throw new Error("offline"); }
    }),
    /Services not ready: Booking Service/
  );
});
