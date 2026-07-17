import assert from "node:assert/strict";
import test from "node:test";
import { getCorrelationId, runWithCorrelationId } from "../src/correlation.js";

test("getCorrelationId reads the id set by the enclosing runWithCorrelationId scope", async () => {
  assert.equal(getCorrelationId(), null);

  await runWithCorrelationId("req-1", async () => {
    assert.equal(getCorrelationId(), "req-1");
    await Promise.resolve();
    assert.equal(getCorrelationId(), "req-1");
  });

  assert.equal(getCorrelationId(), null);
});

test("nested scopes do not leak into concurrent sibling scopes", async () => {
  const seen = [];
  await Promise.all([
    runWithCorrelationId("a", async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      seen.push(getCorrelationId());
    }),
    runWithCorrelationId("b", async () => {
      seen.push(getCorrelationId());
    })
  ]);

  assert.deepEqual(seen.sort(), ["a", "b"]);
});

test("a falsy correlation id normalizes to null", () => {
  runWithCorrelationId(undefined, () => {
    assert.equal(getCorrelationId(), null);
  });
});
