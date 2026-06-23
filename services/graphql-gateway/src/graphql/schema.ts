import { readFile } from "node:fs/promises";

import { getGraphqlSchemaPath } from "../config/paths.js";

export async function loadTypeDefs(): Promise<string> {
  return readFile(getGraphqlSchemaPath(), "utf8");
}
