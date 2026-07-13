import assert from "node:assert/strict";
import test from "node:test";

import { waitForTargets } from "../wait-for-services.mjs";

test("readiness waits until every configured target passes its probe", async () => {
  const attempts = new Map();
  const targets = [{ name: "web" }, { name: "gateway" }];

  await waitForTargets(targets, {
    timeoutMs: 100,
    intervalMs: 1,
    probe: async (target) => {
      const count = (attempts.get(target.name) || 0) + 1;
      attempts.set(target.name, count);
      if (target.name === "gateway" && count < 2) {
        throw new Error("not ready");
      }
    }
  });

  assert.equal(attempts.get("web"), 1);
  assert.equal(attempts.get("gateway"), 2);
});

test("readiness reports the exact services that never become ready", async () => {
  await assert.rejects(
    waitForTargets([{ name: "Booking Service" }], {
      timeoutMs: 0,
      intervalMs: 0,
      probe: async () => { throw new Error("offline"); }
    }),
    /Services not ready: Booking Service/
  );
});
