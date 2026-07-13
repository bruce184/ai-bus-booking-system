import assert from "node:assert/strict";
import test from "node:test";

import { roleAllowedForPortal, sessionCookieOptions } from "../lib/server/gateway.js";

test("portal roles are enforced before an auth cookie is created", () => {
  assert.equal(roleAllowedForPortal("CUSTOMER", "customer"), true);
  assert.equal(roleAllowedForPortal("ADMIN", "customer"), false);
  assert.equal(roleAllowedForPortal("ADMIN", "admin"), true);
  assert.equal(roleAllowedForPortal("STAFF", "admin"), true);
  assert.equal(roleAllowedForPortal("CUSTOMER", "admin"), false);
});

test("session cookie is HttpOnly and scoped to the whole app", () => {
  const options = sessionCookieOptions();
  assert.equal(options.httpOnly, true);
  assert.equal(options.sameSite, "lax");
  assert.equal(options.path, "/");
  assert.equal(options.maxAge, 8 * 60 * 60);
});
