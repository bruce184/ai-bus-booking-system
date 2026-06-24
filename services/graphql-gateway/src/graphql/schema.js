import { readFile } from "node:fs/promises";
import { getGraphqlSchemaPath } from "../config/paths.js";

export async function loadTypeDefs() {
  return readFile(getGraphqlSchemaPath(), "utf8");
}
