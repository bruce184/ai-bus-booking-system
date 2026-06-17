import { existsSync } from "node:fs";

const requiredFiles = [
  "README.md",
  "AGENTS.md",
  ".env.example",
  "docker-compose.yml",
  "docs/README_SETUP.md",
  "docs/ARCHITECTURE.md",
  "docs/API_CONTRACT.md",
  "docs/DATABASE_SCHEMA.md",
  "docs/CODING_GUIDELINES.md",
  "docs/DEV_WORKFLOW.md",
  "docs/agent-context/00-index.md",
  "docs/implementation/02_task_template.md",
  "docs/implementation/handoff/issues_backlog.md",
  "docs/prompts/00-agent-router.md",
  "graphql/schema.graphql",
  "proto/seat_inventory.proto",
  "proto/trip.proto",
  "proto/booking.proto",
  "database/schema.sql",
  "database/seed.sql"
];

const missing = requiredFiles.filter((file) => !existsSync(file));

if (missing.length > 0) {
  console.error("Missing required baseline files:");
  for (const file of missing) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

console.log("Baseline docs and contracts are present.");
