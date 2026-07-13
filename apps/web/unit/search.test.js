import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSearchMetadata,
  fetchSearchTrips,
  resolveSearchInput
} from "../lib/server/search.js";

test("search metadata is derived from URL params without executing a business search", () => {
  const input = resolveSearchInput(
    { from: "TP.HCM", to: "Da Lat", date: "2026-07-15" },
    new Date("2026-07-13T00:00:00.000Z")
  );

  assert.deepEqual(buildSearchMetadata(input), {
    title: "Vé xe TP.HCM đi Da Lat | EcoBus AI",
    description: "Tìm và đặt vé xe khách từ TP.HCM đi Da Lat ngày 2026-07-15."
  });
});

test("server search loader issues exactly one GraphQL request", async () => {
  let requestCount = 0;
  const fetchImpl = async () => {
    requestCount += 1;
    return {
      ok: true,
      async json() {
        return { data: { searchTrips: { trips: [], suggestedDates: [] } } };
      }
    };
  };

  const result = await fetchSearchTrips(
    { origin: "TP.HCM", destination: "Da Lat", departureDate: "2026-07-15" },
    { fetchImpl, endpoint: "http://gateway.test/graphql" }
  );

  assert.equal(requestCount, 1);
  assert.deepEqual(result, { trips: [], suggestedDates: [] });
});
