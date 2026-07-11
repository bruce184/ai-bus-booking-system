import assert from "node:assert/strict";
import test from "node:test";

import { CHECKIN_POLICY, qrPayload, ticketCode, ticketHtml } from "../src/ticketContent.js";

test("qr payload follows the lecturer format bookingCode-ticketId", () => {
  assert.equal(qrPayload("BK202606240001", "abc-123"), "BK202606240001-abc-123");
});

test("ticket codes are dated and sequenced per passenger", () => {
  assert.match(ticketCode(0), /^TK\d{8}001\d{4}$/);
  assert.match(ticketCode(1), /^TK\d{8}002\d{4}$/);
});

test("ticket html contains every field required by the spec", () => {
  const html = ticketHtml({
    booking: { booking_code: "BK202606240001" },
    passenger: { full_name: "Nguyen Van A", seat_label: "A01" },
    trip: {
      origin_name: "TP.HCM",
      destination_name: "Da Lat",
      pickup_point: "Ben xe Mien Dong",
      dropoff_point: "Ben xe Da Lat",
      departure_time: "2026-07-12 08:00",
      vehicle_code: "BUS-01"
    },
    qrPayload: "BK202606240001-t1",
    ticketCode: "TK202607110011234"
  });

  for (const required of [
    "BK202606240001",
    "TK202607110011234",
    "Nguyen Van A",
    "A01",
    "TP.HCM -> Da Lat",
    "Ben xe Mien Dong",
    "Ben xe Da Lat",
    "2026-07-12 08:00",
    "BUS-01",
    "BK202606240001-t1",
    CHECKIN_POLICY
  ]) {
    assert.ok(html.includes(required), `missing ${required}`);
  }
});
