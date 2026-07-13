import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  flowCookieOptions,
  normalizeFlowContext,
  readFlowContext,
  sealFlowContext
} from "../lib/server/flow-context.js";

const secret = "test-only-flow-secret";
const now = Date.parse("2026-07-13T08:00:00.000Z");

test("flow contexts are encrypted, bound to their kind, and reject tampering", () => {
  const context = {
    bookingCode: "BK202607130001",
    email: "guest@example.com"
  };
  const token = sealFlowContext("booking", context, { secret, now });

  assert.equal(token.includes(context.email), false);
  assert.deepEqual(readFlowContext("booking", token, { secret, now }), context);
  assert.equal(readFlowContext("checkout", token, { secret, now }), null);

  const tampered = `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`;
  assert.equal(readFlowContext("booking", tampered, { secret, now }), null);
});

test("flow context expiry is enforced inside the encrypted envelope", () => {
  const context = {
    bookingCode: "BK202607130002",
    email: "guest@example.com"
  };
  const token = sealFlowContext("booking", context, { secret, now });

  assert.equal(
    readFlowContext("booking", token, { secret, now: now + 30 * 60 * 1000 }),
    null
  );
});

test("checkout context is bounded by the canonical hold expiry", () => {
  const context = normalizeFlowContext(
    "checkout",
    {
      tripId: "trip-demo-001",
      holdToken: "hold-token-123",
      seats: ["A01", "A01", "A02"],
      expiresAt: new Date(now + 5 * 60 * 1000).toISOString()
    },
    now
  );

  assert.deepEqual(context.seats, ["A01", "A02"]);
  const options = flowCookieOptions("checkout", context, now);
  assert.equal(options.httpOnly, true);
  assert.equal(options.sameSite, "lax");
  assert.equal(options.path, "/");
  assert.equal(options.maxAge, 5 * 60);
});

test("sensitive checkout and lookup values never return to URL hand-offs", () => {
  const tripClient = readFileSync(
    new URL("../app/trips/[tripId]/_TripDetailClient.jsx", import.meta.url),
    "utf8"
  );
  const checkout = readFileSync(new URL("../app/checkout/page.js", import.meta.url), "utf8");
  const payment = readFileSync(new URL("../app/payment/page.js", import.meta.url), "utf8");
  const lookup = readFileSync(new URL("../app/lookup/page.js", import.meta.url), "utf8");
  const booking = readFileSync(
    new URL("../app/booking/[bookingCode]/page.js", import.meta.url),
    "utf8"
  );

  assert.doesNotMatch(tripClient, /\/checkout\?/);
  assert.doesNotMatch(checkout, /\/payment\?/);
  assert.doesNotMatch(payment, /\?email=/);
  assert.doesNotMatch(lookup, /\?email=/);
  assert.doesNotMatch(booking, /searchParams/);
});
