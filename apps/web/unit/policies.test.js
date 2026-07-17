import assert from "node:assert/strict";
import test from "node:test";

import {
  CANCELLATION_POLICY_TEXT,
  CANCELLATION_POLICY_URI,
  CHECKIN_POLICY_TEXT,
  CHECKIN_POLICY_URI
} from "@bus/shared/policies.js";
import { policyResources } from "../lib/chatbot/tools.js";

test("chatbot policy resources mirror the canonical business rules", () => {
  assert.deepEqual(policyResources.cancellation, {
    source: CANCELLATION_POLICY_URI,
    text: CANCELLATION_POLICY_TEXT
  });
  assert.deepEqual(policyResources.checkin, {
    source: CHECKIN_POLICY_URI,
    text: CHECKIN_POLICY_TEXT
  });
});
