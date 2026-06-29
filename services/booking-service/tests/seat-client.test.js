import assert from "node:assert/strict";
import test from "node:test";

import { seatInventoryAddress } from "../src/seat-client.js";

test("seat inventory client prefers the documented service address env var", () => {
  assert.equal(
    seatInventoryAddress({
      SEAT_INVENTORY_SERVICE_GRPC_ADDRESS: "127.0.0.1:60052",
      SEAT_INVENTORY_GRPC_URL: "127.0.0.1:50052"
    }),
    "127.0.0.1:60052"
  );
});

test("seat inventory client keeps the legacy env var as fallback", () => {
  assert.equal(
    seatInventoryAddress({
      SEAT_INVENTORY_GRPC_URL: "127.0.0.1:50052"
    }),
    "127.0.0.1:50052"
  );
});

test("seat inventory client defaults to the documented local port", () => {
  assert.equal(seatInventoryAddress({}), "localhost:50052");
});
