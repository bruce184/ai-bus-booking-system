import { createInsecureClient, loadProto, promisifyGrpc } from "@bus/shared/grpc.js";

let seatClient;

export function seatInventoryAddress(env = process.env) {
  return (
    env.SEAT_INVENTORY_SERVICE_GRPC_ADDRESS ||
    env.SEAT_INVENTORY_GRPC_URL ||
    "localhost:50052"
  );
}

export function releaseHoldRequest({ holdToken }) {
  return {
    hold_token: holdToken
  };
}

function client() {
  if (!seatClient) {
    const proto = loadProto("seat_inventory.proto");
    seatClient = createInsecureClient(
      proto.bus.seat.v1.SeatInventoryService,
      seatInventoryAddress()
    );
  }
  return seatClient;
}

export async function confirmSeats({ tripId, seatIds, holdToken, bookingId }) {
  if (process.env.SKIP_SEAT_CONFIRMATION === "true") {
    console.warn("[booking-service] SKIP_SEAT_CONFIRMATION=true, not calling Seat Inventory Service");
    return { seats: seatIds.map((seatId) => ({ id: seatId, label: seatId, status: "BOOKED" })) };
  }

  return promisifyGrpc(client(), "ConfirmSeats", {
    trip_id: tripId,
    seat_ids: seatIds,
    hold_token: holdToken,
    booking_id: bookingId
  });
}

export async function releaseSeatHold({ holdToken }) {
  return promisifyGrpc(client(), "ReleaseHold", releaseHoldRequest({ holdToken }));
}
