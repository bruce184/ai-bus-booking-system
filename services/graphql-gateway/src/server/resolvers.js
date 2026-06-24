import { GraphQLScalarType, Kind } from "graphql";

import { gatewayError } from "../auth/errors.js";
import { signDemoJwt } from "../auth/jwt.js";
import { findDemoUserByCredentials } from "../auth/users.js";
import { adminMutationResolvers } from "./adminResolvers.js";
import { callGrpc } from "../grpc/call.js";
import { requireAdmin } from "../auth/authorization.js";
import { publishSeatStateChanged, subscribeSeatStateChanged } from "./seatStatePubSub.js";

function requesterIdFromContext(context) {
  return context.user?.id ?? context.requestId ?? "guest";
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
      return {
        from: args.input.from,
        to: args.input.to,
        totalRevenue: 1860000,
        paidBookings: 5,
        ticketsSold: 6,
        successfulBookingRate: 1.56
      };
    },
    adminAnalyticsDashboard: async (_parent, args, context) => {
      requireAdmin(context);
      return {
        revenueSummary: {
          from: args.input.from,
          to: args.input.to,
          totalRevenue: 1860000,
          paidBookings: 5,
          ticketsSold: 6,
          successfulBookingRate: 1.56
        },
        dailyRevenue: [
          { date: '2026-06-18', revenue: 280000, paidBookings: 1, ticketsSold: 1 },
          { date: '2026-06-19', revenue: 560000, paidBookings: 1, ticketsSold: 2 },
          { date: '2026-06-20', revenue: 320000, paidBookings: 1, ticketsSold: 1 },
          { date: '2026-06-21', revenue: 180000, paidBookings: 1, ticketsSold: 1 },
          { date: '2026-06-22', revenue: 520000, paidBookings: 1, ticketsSold: 1 },
          { date: '2026-06-23', revenue: 0, paidBookings: 0, ticketsSold: 0 },
          { date: '2026-06-24', revenue: 0, paidBookings: 0, ticketsSold: 0 }
        ],
        ticketsByRoute: [
          { origin: 'TP.HCM', destination: 'Đà Lạt', ticketsSold: 3, revenue: 840000 },
          { origin: 'Đà Nẵng', destination: 'Hà Nội', ticketsSold: 1, revenue: 520000 },
          { origin: 'TP.HCM', destination: 'Nha Trang', ticketsSold: 1, revenue: 320000 },
          { origin: 'TP.HCM', destination: 'Cần Thơ', ticketsSold: 1, revenue: 180000 }
        ],
        popularRoutes: [
          { origin: 'TP.HCM', destination: 'Đà Nẵng', searchCount: 63 },
          { origin: 'TP.HCM', destination: 'Đà Lạt', searchCount: 97 },
          { origin: 'Đà Nẵng', destination: 'Hà Nội', searchCount: 47 },
          { origin: 'TP.HCM', destination: 'Nha Trang', searchCount: 82 },
          { origin: 'TP.HCM', destination: 'Cần Thơ', searchCount: 31 }
        ]
      };
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

      return response.released;
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
  Subscription: {
    seatStateChanged: {
      subscribe: (_parent, args) => subscribeSeatStateChanged(args.tripId)
    }
  }
};
