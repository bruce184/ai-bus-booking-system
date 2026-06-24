import { GraphQLError } from "graphql";

export function gatewayError(message, code) {
  return new GraphQLError(message, {
    extensions: {
      code
    }
  });
}
