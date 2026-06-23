import { GraphQLScalarType, Kind } from "graphql";

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
  }
};
