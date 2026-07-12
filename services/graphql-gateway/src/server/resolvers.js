import { GraphQLScalarType, Kind } from "graphql";

import { getAnalyticsDashboard, getAnalyticsRevenueSummary } from "../analytics/client.js";
import { gatewayError } from "../auth/errors.js";
import { signDemoJwt } from "../auth/jwt.js";
import { findDemoUserByCredentials } from "../auth/users.js";
import { adminMutationResolvers } from "./adminResolvers.js";
import { callGrpc } from "../grpc/call.js";
import { requireAdmin, requireUser } from "../auth/authorization.js";
import { publishSeatStateChanged, subscribeSeatStateChanged } from "./seatStatePubSub.js";
import { publishBookingUpdated, subscribeBookingUpdated } from "./bookingUpdatedPubSub.js";

function requesterIdFromContext(context) {
  return context.user?.id ?? context.requestId ?? "guest";
}

// Broadcast real seat states (from Seat Inventory) instead of fabricating
// coordinates. Best-effort: a failed fetch must not fail the mutation.
async function publishSeatStates(context, tripId, seatIds) {
  if (!tripId || !seatIds?.length) {
    return;
  }

  try {
    const response = await callGrpc(context.grpc.seatInventory, "getSeatMap", { tripId });
    const wanted = new Set(seatIds);
    const seats = (response.seats || []).filter((seat) => wanted.has(seat.id));

    if (seats.length) {
      publishSeatStateChanged(tripId, seats);
    }
  } catch {
    // Subscribers refetch on their next interaction.
  }
}

function parseDateTime(value) {
  if (typeof value !== "string" && typeof value !== "number" && !(value instanceof Date)) {
    throw new TypeError("DateTime must be a string, number, or Date.");
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new TypeError("DateTime must be a valid date.");
  }

  return date.toISOString();
}

export const resolvers = {
  DateTime: new GraphQLScalarType({
    name: "DateTime",
    description: "ISO-8601 date-time string.",
    serialize: parseDateTime,
    parseValue: parseDateTime,
    parseLiteral(ast) {
      if (ast.kind !== Kind.STRING) {
        throw new TypeError("DateTime literal must be a string.");
      }

      return parseDateTime(ast.value);
    }
  }),
  Query: {
    me: (_parent, _args, context) => context.user,
    autocompleteLocations: async (_parent, args, context) => {
      const response = await callGrpc(
        context.grpc.trip,
        "autocompleteLocations",
        { keyword: args.keyword }
      );
      return response.locations || [];
    },
    searchTrips: async (_parent, args, context) => {
      return callGrpc(
        context.grpc.trip,
        "searchTrips",
        args.input
      );
    },
    trip: async (_parent, args, context) => {
      return callGrpc(
        context.grpc.trip,
        "getTripDetail",
        { tripId: args.id }
      );
    },
    popularRoutes: async (_parent, args, context) => {
      const response = await callGrpc(
        context.grpc.trip,
        "listPopularRoutes",
        { limit: args.limit ?? 5 }
      );
      return response.routes || [];
    },
    bookingStatus: async (_parent, args, context) => {
      return callGrpc(
        context.grpc.booking,
        "getBookingStatus",
        { bookingCode: args.bookingCode, email: args.email }
      );
    },
    myBookings: async (_parent, _args, context) => {
      const customerId = requireUser(context).id;
      const response = await callGrpc(
        context.grpc.booking,
        "listCustomerBookings",
        { customerUserId: customerId }
      );
      return response.bookings || [];
    },
    mySavedPassengers: async (_parent, _args, context) => {
      const customerId = requireUser(context).id;
      const response = await callGrpc(
        context.grpc.booking,
        "listPassengerProfiles",
        { customerUserId: customerId }
      );
      return response.passengers || [];
    },
    adminBookings: async (_parent, args, context) => {
      requireAdmin(context);
      const request = {
        tripId: args.input.tripId ?? "",
        status: args.input.status ?? "BOOKING_STATUS_UNSPECIFIED",
        email: args.input.email ?? "",
        bookingCode: args.input.bookingCode ?? "",
        limit: args.input.limit ?? 20,
        offset: args.input.offset ?? 0
      };
      const response = await callGrpc(
        context.grpc.booking,
        "listAdminBookings",
        request
      );
      return {
        items: response.bookings || [],
        total: response.total || 0
      };
    },
    adminEventLogs: async (_parent, args, context) => {
      requireAdmin(context);
      const input = args.input || {};
      const request = {
        eventType: input.eventType ?? "",
        entityType: input.entityType ?? "",
        limit: input.limit ?? 20,
        offset: input.offset ?? 0
      };
      const response = await callGrpc(
        context.grpc.booking,
        "listEventLogs",
        request
      );
      return response.logs || [];
    },
    seatMap: async (_parent, args, context) => {
      const response = await callGrpc(
        context.grpc.seatInventory,
        "getSeatMap",
        { tripId: args.tripId }
      );
      return response.seats || [];
    },
    adminRevenueSummary: async (_parent, args, context) => {
      requireAdmin(context);
      return getAnalyticsRevenueSummary({
        baseUrl: context.config.analytics.baseUrl,
        range: args.input
      });
    },
    adminAnalyticsDashboard: async (_parent, args, context) => {
      requireAdmin(context);
      return getAnalyticsDashboard({
        baseUrl: context.config.analytics.baseUrl,
        range: args.input
      });
    },
    adminLocations: async (_parent, _args, context) => {
      requireAdmin(context);
      const response = await callGrpc(
        context.grpc.trip,
        "listLocations",
        {}
      );
      return response.locations || [];
    },
    adminRoutes: async (_parent, _args, context) => {
      requireAdmin(context);
      const response = await callGrpc(
        context.grpc.trip,
        "listRoutes",
        {}
      );
      return response.routes || [];
    },
    adminVehicles: async (_parent, _args, context) => {
      requireAdmin(context);
      const response = await callGrpc(
        context.grpc.trip,
        "listVehicles",
        {}
      );
      return response.vehicles || [];
    },
    adminTrips: async (_parent, _args, context) => {
      requireAdmin(context);
      const response = await callGrpc(
        context.grpc.trip,
        "listTrips",
        {}
      );
      return response.trips || [];
    },
    adminStops: async (_parent, _args, context) => {
      requireAdmin(context);
      const response = await callGrpc(
        context.grpc.trip,
        "listRoutes",
        {}
      );
      const stops = [];
      for (const route of response.routes || []) {
        for (const stop of route.stops || []) {
          stops.push({
            id: stop.id,
            name: stop.name,
            address: stop.address,
            stopType: stop.stopType,
            stopOrder: stop.stopOrder,
            routeId: route.id,
            locationId: stop.locationId
          });
        }
      }
      return stops;
    }
  },
  Mutation: {
    ...adminMutationResolvers,
    login: (
      _parent,
      args,
      context
    ) => {
      const email = args.input.email.trim();
      const password = args.input.password;

      if (!email || !password) {
        throw gatewayError("Email and password are required.", "VALIDATION_ERROR");
      }

      const user = findDemoUserByCredentials(email, password);

      if (!user) {
        throw gatewayError("Invalid email or password.", "UNAUTHORIZED");
      }

      const { token, expiresAt } = signDemoJwt(user, context.config);

      return {
        token,
        user,
        expiresAt
      };
    },

    holdSeats: async (_parent, args, context) => {
      const hold = await callGrpc(
        context.grpc.seatInventory,
        "holdSeats",
        {
          tripId: args.input.tripId,
          seatIds: args.input.seatIds,
          requesterId: requesterIdFromContext(context)
        }
      );

      publishSeatStateChanged(hold.tripId, hold.seats);

      return hold;
    },

    releaseSeatHold: async (_parent, args, context) => {
      const response = await callGrpc(
        context.grpc.seatInventory,
        "releaseHold",
        { holdToken: args.input.holdToken }
      );

      if (response.released) {
        await publishSeatStates(context, response.tripId, response.seatIds);
      }

      return response.released;
    },

    createBooking: async (_parent, args, context) => {
      const input = args.input;
      return callGrpc(context.grpc.booking, "createBooking", {
        tripId: input.tripId,
        holdToken: input.holdToken,
        customerUserId: context.user?.id ?? "",
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone ?? "",
        passengers: (input.passengers || []).map((p) => ({
          fullName: p.fullName,
          phone: p.phone ?? "",
          email: p.email ?? "",
          documentNumber: p.documentNumber ?? "",
          seatId: p.seatId
        }))
      });
    },

    simulatePayment: async (_parent, args, context) => {
      const booking = await callGrpc(context.grpc.booking, "simulatePayment", {
        bookingCode: args.input.bookingCode,
        success: args.input.success,
        email: args.input.email
      });

      if (args.input.success && booking) {
        await publishSeatStates(
          context,
          booking.tripId,
          (booking.passengers || []).map((p) => p.seatId)
        );
        publishBookingUpdated(booking);
      }

      return booking;
    },

    cancelBooking: async (_parent, args, context) => {
      const booking = await callGrpc(context.grpc.booking, "cancelBooking", {
        bookingCode: args.input.bookingCode,
        email: args.input.email
      });

      if (booking) {
        await publishSeatStates(
          context,
          booking.tripId,
          (booking.passengers || []).map((p) => p.seatId)
        );
        publishBookingUpdated(booking);
      }

      return booking;
    },

    savePassengerProfile: async (_parent, args, context) => {
      const input = args.input;
      const response = await callGrpc(context.grpc.booking, "savePassengerProfile", {
        customerUserId: requireUser(context).id,
        fullName: input.fullName,
        phone: input.phone ?? "",
        email: input.email ?? "",
        documentNumber: input.documentNumber ?? ""
      });
      return response.passenger;
    },

    deleteSavedPassenger: async (_parent, args, context) => {
      const response = await callGrpc(context.grpc.booking, "deletePassengerProfile", {
        customerUserId: requireUser(context).id,
        id: args.id
      });
      return response.deleted;
    }
  },
  Booking: {
    trip: async (parent, _args, context) => {
      if (!parent.tripId) {
        return null;
      }
      const response = await callGrpc(
        context.grpc.trip,
        "getTripDetail",
        { tripId: parent.tripId }
      );
      return response.trip;
    }
  },
  TripDetail: {
    seats: async (parent, _args, context) => {
      const response = await callGrpc(
        context.grpc.seatInventory,
        "getSeatMap",
        { tripId: parent.trip?.id }
      );
      return response.seats || [];
    }
  },
  Subscription: {
    seatStateChanged: {
      subscribe: (_parent, args) => subscribeSeatStateChanged(args.tripId)
    },
    bookingUpdated: {
      // Same bookingCode+email pairing as the bookingStatus query: proves the
      // subscriber actually knows the booking before it can stream its PII.
      subscribe: async (_parent, args, context) => {
        await callGrpc(context.grpc.booking, "getBookingStatus", {
          bookingCode: args.bookingCode,
          email: args.email
        });
        return subscribeBookingUpdated(args.bookingCode);
      }
    }
  }
};
