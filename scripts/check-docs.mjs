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
  "docs/agent-context/01-system-overview.md",
  "docs/agent-context/02-project-structure.md",
  "docs/agent-context/03-architecture.md",
  "docs/agent-context/04-feature-scope.md",
  "docs/agent-context/05-data-api-contract.md",
  "docs/agent-context/06-ui-design.md",
  "docs/agent-context/07-security-privacy.md",
  "docs/agent-context/08-agent-task-playbook.md",
  "docs/agent-context/09-known-risks-and-backlog.md",
  "docs/implementation/02_task_template.md",
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
