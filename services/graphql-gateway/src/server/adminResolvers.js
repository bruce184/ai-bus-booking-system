import {
  AdminInputError,
  normalizeRouteInput,
  normalizeStopInput,
  normalizeTripInput,
  normalizeVehicleInput,
  normalizeVehicleSeatLayout
} from "@bus/shared/admin-contract.js";

import { requireAdmin, requireAdminOrStaff } from "../auth/authorization.js";
import { gatewayError } from "../auth/errors.js";
import { callGrpc } from "../grpc/call.js";
import { publishSeatStateChanged } from "./seatStatePubSub.js";
import { publishBookingUpdated } from "./bookingUpdatedPubSub.js";

function requireNonEmpty(value, fieldName) {
  const trimmed = typeof value === "string" ? value.trim() : "";

  if (!trimmed) {
    throw gatewayError(`${fieldName} is required.`, "VALIDATION_ERROR");
  }

  return trimmed;
}

function validateAdminInput(work) {
  try {
    return work();
  } catch (error) {
    if (error instanceof AdminInputError) {
      throw gatewayError(error.message, "VALIDATION_ERROR");
    }
    throw error;
  }
}

export function mapRouteInput(input, id) {
  const normalized = validateAdminInput(() => normalizeRouteInput(input));
  return { id: id ?? "", ...normalized };
}

export function mapStopInput(input, id) {
  const normalized = validateAdminInput(() => normalizeStopInput(input));
  return { id: id ?? "", ...normalized };
}

export function mapVehicleInput(input, id) {
  const normalized = validateAdminInput(() => normalizeVehicleInput(input));
  return { id: id ?? "", ...normalized };
}

export function mapTripInput(input, id) {
  const normalized = validateAdminInput(() => normalizeTripInput(
    input,
    { isUpdate: Boolean(id) }
  ));
  return {
    id: id ?? "",
    ...normalized,
    status: normalized.status ?? "TRIP_STATUS_UNSPECIFIED"
  };
}

export function mapVehicleSeats(seats) {
  return validateAdminInput(() => normalizeVehicleSeatLayout(seats))
    .map((seat) => ({ id: "", ...seat }));
}

export const adminMutationResolvers = {
  adminCreateRoute: async (_parent, args, context) => {
    requireAdmin(context);
    const request = mapRouteInput(args.input);
    const response = await callGrpc(
      context.grpc.trip,
      "createRoute",
      request
    );
    return response.route;
  },

  adminUpdateRoute: async (_parent, args, context) => {
    requireAdmin(context);
    const request = mapRouteInput(args.input, requireNonEmpty(args.id, "id"));
    const response = await callGrpc(
      context.grpc.trip,
      "updateRoute",
      request
    );
    return response.route;
  },

  adminDeleteRoute: async (_parent, args, context) => {
    requireAdmin(context);
    const request = { id: requireNonEmpty(args.id, "id") };
    const response = await callGrpc(context.grpc.trip, "deleteRoute", request);
    return response.deleted;
  },

  adminCreateStop: async (_parent, args, context) => {
    requireAdmin(context);
    const request = mapStopInput(args.input);
    const response = await callGrpc(
      context.grpc.trip,
      "createStop",
      request
    );
    return response.stop;
  },

  adminUpdateStop: async (_parent, args, context) => {
    requireAdmin(context);
    const request = mapStopInput(args.input, requireNonEmpty(args.id, "id"));
    const response = await callGrpc(
      context.grpc.trip,
      "updateStop",
      request
    );
    return response.stop;
  },

  adminDeleteStop: async (_parent, args, context) => {
    requireAdmin(context);
    const request = { id: requireNonEmpty(args.id, "id") };
    const response = await callGrpc(context.grpc.trip, "deleteStop", request);
    return response.deleted;
  },

  adminCreateVehicle: async (_parent, args, context) => {
    requireAdmin(context);
    const request = mapVehicleInput(args.input);
    const response = await callGrpc(
      context.grpc.trip,
      "createVehicle",
      request
    );
    return response.vehicle;
  },

  adminUpdateVehicle: async (_parent, args, context) => {
    requireAdmin(context);
    const request = mapVehicleInput(args.input, requireNonEmpty(args.id, "id"));
    const response = await callGrpc(
      context.grpc.trip,
      "updateVehicle",
      request
    );
    return response.vehicle;
  },

  adminDeleteVehicle: async (_parent, args, context) => {
    requireAdmin(context);
    const request = { id: requireNonEmpty(args.id, "id") };
    const response = await callGrpc(context.grpc.trip, "deleteVehicle", request);
    return response.deleted;
  },

  adminConfigureVehicleSeats: async (
    _parent,
    args,
    context
  ) => {
    requireAdmin(context);
    const request = {
      vehicleId: requireNonEmpty(args.vehicleId, "vehicleId"),
      seats: mapVehicleSeats(args.seats)
    };
    const response = await callGrpc(
      context.grpc.trip,
      "configureVehicleSeats",
      request
    );
    return response.seats;
  },

  adminCreateTrip: async (_parent, args, context) => {
    requireAdmin(context);
    const request = mapTripInput(args.input);
    const response = await callGrpc(
      context.grpc.trip,
      "createTrip",
      request
    );
    return response.trip;
  },

  adminUpdateTrip: async (_parent, args, context) => {
    requireAdmin(context);
    const request = mapTripInput(args.input, requireNonEmpty(args.id, "id"));
    const response = await callGrpc(
      context.grpc.trip,
      "updateTrip",
      request
    );
    return response.trip;
  },

  adminDeleteTrip: async (_parent, args, context) => {
    requireAdmin(context);
    const request = { id: requireNonEmpty(args.id, "id") };
    const response = await callGrpc(context.grpc.trip, "deleteTrip", request);
    return response.deleted;
  },

  adminUpdateTripStatus: async (
    _parent,
    args,
    context
  ) => {
    requireAdmin(context);
    const request = {
      tripId: requireNonEmpty(args.input.tripId, "tripId"),
      status: args.input.status
    };
    const response = await callGrpc(
      context.grpc.trip,
      "updateTripStatus",
      request
    );
    return response.trip;
  },

  adminBlockSeats: async (_parent, args, context) => {
    const admin = requireAdmin(context);

    if (!args.input.seatIds || args.input.seatIds.length === 0) {
      throw gatewayError("At least one seat id is required.", "VALIDATION_ERROR");
    }

    const tripId = requireNonEmpty(args.input.tripId, "tripId");
    const request = {
      tripId,
      seatIds: args.input.seatIds.map((seatId) => requireNonEmpty(seatId, "seatId")),
      reason: args.input.reason ?? "",
      adminUserId: admin.id
    };
    const response = await callGrpc(
      context.grpc.seatInventory,
      "blockSeats",
      request
    );

    if (response.seats?.length) {
      publishSeatStateChanged(tripId, response.seats);
    }

    return response.seats;
  },

  adminCheckIn: async (_parent, args, context) => {
    const staffUser = requireAdminOrStaff(context);
    const request = {
      code: requireNonEmpty(args.input.code, "code"),
      staffUserId: staffUser.id
    };
    const booking = await callGrpc(context.grpc.booking, "checkInPassenger", request);
    publishBookingUpdated(booking);
    return booking;
  }
};
