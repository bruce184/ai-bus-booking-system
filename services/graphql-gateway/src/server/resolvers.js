import { GraphQLScalarType, Kind } from "graphql";

import { gatewayError } from "../auth/errors.js";
import { signDemoJwt } from "../auth/jwt.js";
import { findDemoUserByCredentials } from "../auth/users.js";
import { adminMutationResolvers } from "./adminResolvers.js";
import { callGrpc } from "../grpc/call.js";
import { requireAdmin } from "../auth/authorization.js";

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
  }
};
