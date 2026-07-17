import assert from "node:assert/strict";
import test from "node:test";

import {
  CANCELLATION_POLICY_TEXT,
  CHECKIN_POLICY_TEXT
} from "@bus/shared/policies.js";
import {
  CANCELLATION_POLICY,
  CHECKIN_POLICY
} from "../src/policies.js";

test("trip detail policy text uses the shared business-rule source", () => {
  assert.equal(CANCELLATION_POLICY, CANCELLATION_POLICY_TEXT);
  assert.equal(CHECKIN_POLICY, CHECKIN_POLICY_TEXT);
});
