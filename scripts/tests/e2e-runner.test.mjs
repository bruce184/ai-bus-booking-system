import assert from "node:assert/strict";
import test from "node:test";

import {
  buildE2EPlan,
  runHermeticWebE2E
} from "../run-web-e2e.mjs";

test("E2E plan isolates infrastructure and removes its volume", () => {
  const plan = buildE2EPlan({});

  assert.match(plan.env.DATABASE_URL, /localhost:15432/);
  assert.equal(plan.env.REDIS_URL, "redis://localhost:16379");
  assert.equal(plan.env.RABBITMQ_URL, "amqp://localhost:25672");
  assert.equal(plan.env.KAFKA_BROKERS, "localhost:29092");
  assert.deepEqual(
    plan.down.slice(-2),
    ["-v", "--remove-orphans"]
  );
});

test("E2E runner cleans up after Playwright failure", async () => {
  const calls = [];

  await assert.rejects(
    runHermeticWebE2E(
      {},
      {
        dockerCommand: "docker",
        npmCommand: "npm",
        execute: async (command, args) => {
          calls.push({ command, args });
          if (command === "npm") {
            throw new Error("playwright failed");
          }
        }
      }
    ),
    /playwright failed/
  );

  assert.equal(calls.length, 3);
  assert.deepEqual(
    calls[2].args.slice(-3),
    ["down", "-v", "--remove-orphans"]
  );
});
