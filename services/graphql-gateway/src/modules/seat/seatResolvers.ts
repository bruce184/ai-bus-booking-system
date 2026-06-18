import { callSeatInventory } from "../../grpc/seatInventoryClient.js";
import type {
  GatewayContext,
  GetSeatMapResponse,
  HoldSeatsArgs,
  HoldSeatsResponse,
  ReleaseHoldResponse,
  ReleaseSeatHoldArgs,
  Seat,
  SeatHold,
  SeatMapArgs
} from "./seatTypes.js";

function requesterIdFromContext(context: GatewayContext): string {
  return context.user?.id ?? context.requestId ?? "guest";
}

export const seatResolvers = {
  Query: {
    async seatMap(
      _parent: unknown,
      args: SeatMapArgs
    ): Promise<Seat[]> {
      const response = await callSeatInventory<{ tripId: string }, GetSeatMapResponse>(
        "getSeatMap",
        { tripId: args.tripId }
      );

      return response.seats;
    }
  },

  Mutation: {
    async holdSeats(
      _parent: unknown,
      args: HoldSeatsArgs,
      context: GatewayContext
    ): Promise<SeatHold> {
      return callSeatInventory<
        { tripId: string; seatIds: string[]; requesterId: string },
        HoldSeatsResponse
      >("holdSeats", {
        tripId: args.input.tripId,
        seatIds: args.input.seatIds,
        requesterId: requesterIdFromContext(context)
      });
    },

    async releaseSeatHold(
      _parent: unknown,
      args: ReleaseSeatHoldArgs
    ): Promise<boolean> {
      const response = await callSeatInventory<{ holdToken: string }, ReleaseHoldResponse>(
        "releaseHold",
        { holdToken: args.input.holdToken }
      );

      return response.released;
    }
  }
};
