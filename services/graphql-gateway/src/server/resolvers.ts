import { GraphQLScalarType, Kind } from "graphql";

import { gatewayError } from "../auth/errors.js";
import { signDemoJwt } from "../auth/jwt.js";
import { findDemoUserByCredentials } from "../auth/users.js";
import type { GatewayContext } from "./context.js";

function parseDateTime(value: unknown): string {
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
    me: (_parent: unknown, _args: Record<string, never>, context: GatewayContext) => context.user
  },
  Mutation: {
    login: (
      _parent: unknown,
      args: { input: { email: string; password: string } },
      context: GatewayContext
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
  }
};
