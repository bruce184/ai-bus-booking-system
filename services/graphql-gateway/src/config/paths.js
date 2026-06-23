import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const serviceRoot = resolve(currentDir, "../..");

function findRepoRoot(startDir) {
  let cursor = startDir;

  while (true) {
    const schemaPath = resolve(cursor, "graphql/schema.graphql");
    const protoPath = resolve(cursor, "proto");

    if (existsSync(schemaPath) && existsSync(protoPath)) {
      return cursor;
    }

    const parent = resolve(cursor, "..");

    if (parent === cursor) {
      throw new Error("Unable to locate repository root from GraphQL Gateway.");
    }

    cursor = parent;
  }
}

export const repoRoot = findRepoRoot(serviceRoot);

export function getGraphqlSchemaPath() {
  return resolve(repoRoot, "graphql/schema.graphql");
}

export function getProtoPath(fileName) {
  return resolve(repoRoot, "proto", fileName);
}
