import { GraphQLError } from "graphql";

export type GatewayErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INTERNAL_ERROR";

export function gatewayError(message: string, code: GatewayErrorCode): GraphQLError {
  return new GraphQLError(message, {
    extensions: {
      code
    }
  });
}
