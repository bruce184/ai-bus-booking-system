import { requireAdmin, requireAdminOrStaff } from "../auth/authorization.js";
import { gatewayError } from "../auth/errors.js";
import { callGrpc } from "../grpc/call.js";

function requireNonEmpty(value, fieldName) {
  const trimmed = typeof value === "string" ? value.trim() : "";

  if (!trimmed) {
    throw gatewayError(`${fieldName} is required.`, "VALIDATION_ERROR");
  }

  return trimmed;
}

function mapRouteInput(input, id) {
  return {
    id: id ?? "",
    originLocationId: requireNonEmpty(input.originLocationId, "originLocationId"),
    destinationLocationId: requireNonEmpty(input.destinationLocationId, "destinationLocationId"),
    distanceKm: input.distanceKm ?? 0
  };
}

function mapStopInput(input, id) {
  return {
    id: id ?? "",
    routeId: requireNonEmpty(input.routeId, "routeId"),
    locationId: requireNonEmpty(input.locationId, "locationId"),
    stopType: requireNonEmpty(input.stopType, "stopType"),
    stopOrder: input.stopOrder
  };
}

function mapVehicleInput(input, id) {
  return {
    id: id ?? "",
    operatorName: requireNonEmpty(input.operatorName, "operatorName"),
    vehicleCode: requireNonEmpty(input.vehicleCode, "vehicleCode"),
    licensePlate: input.licensePlate ?? "",
    vehicleType: requireNonEmpty(input.vehicleType, "vehicleType"),
    seatCount: input.seatCount
  };
}

function mapTripInput(input, id) {
  return {
    id: id ?? "",
    routeId: requireNonEmpty(input.routeId, "routeId"),
    vehicleId: requireNonEmpty(input.vehicleId, "vehicleId"),
    departureTime: input.departureTime,
    arrivalTime: input.arrivalTime,
    price: input.price,
    status: input.status ?? "DRAFT"
  };
}

function mapVehicleSeats(seats) {
  if (!seats || seats.length === 0) {
    throw gatewayError("At least one vehicle seat is required.", "VALIDATION_ERROR");
  }

  return seats.map((seat) => ({
    id: "",
    label: requireNonEmpty(seat.label, "seat.label"),
    deck: seat.deck,
    row: seat.row,
    column: seat.column
  }));
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

    const request = {
      tripId: requireNonEmpty(args.input.tripId, "tripId"),
      seatIds: args.input.seatIds.map((seatId) => requireNonEmpty(seatId, "seatId")),
      reason: args.input.reason ?? "",
      adminUserId: admin.id
    };
    const response = await callGrpc(
      context.grpc.seatInventory,
      "blockSeats",
      request
    );
    return response.seats;
  },

  adminCheckIn: async (_parent, args, context) => {
    const staffUser = requireAdminOrStaff(context);
    const request = {
      code: requireNonEmpty(args.input.code, "code"),
      staffUserId: staffUser.id
    };
    return callGrpc(context.grpc.booking, "checkInPassenger", request);
  }
};
