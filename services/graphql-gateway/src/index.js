import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { GraphQLScalarType, Kind } from "graphql";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { createYoga } from "graphql-yoga";
import { bookingResolvers } from "./resolvers/booking.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const typeDefs = fs.readFileSync(path.join(repoRoot, "graphql/schema.graphql"), "utf8");

const DateTime = new GraphQLScalarType({
  name: "DateTime",
  serialize: (value) => new Date(value).toISOString(),
  parseValue: (value) => new Date(value).toISOString(),
  parseLiteral: (ast) => (ast.kind === Kind.STRING ? new Date(ast.value).toISOString() : null)
});

const schema = makeExecutableSchema({
  typeDefs,
  resolvers: [{ DateTime }, bookingResolvers]
});

const yoga = createYoga({
  schema,
  graphqlEndpoint: "/graphql",
  context: ({ request }) => ({ request })
});

const server = createServer(yoga);
const port = Number(process.env.GRAPHQL_GATEWAY_PORT || 4000);

server.listen(port, () => {
  console.log(`[graphql-gateway] ready at http://localhost:${port}/graphql`);
});
