import test from "node:test";
import assert from "node:assert";
import { GraphQLError } from "graphql";

// Import modules to test
import { listDemoUsers, findDemoUserByCredentials, findDemoUserById } from "../src/auth/users.js";
import { signDemoJwt, verifyDemoJwt } from "../src/auth/jwt.js";
import { requireUser, requireRole, requireAdmin, requireAdminOrStaff } from "../src/auth/authorization.js";
import { createContextFactory } from "../src/server/context.js";

// Mock configuration
const mockConfig = {
  auth: {
    jwtSecret: "test_secret_key_at_least_32_bytes_long_for_security_1234",
    jwtExpiresInSeconds: 3600
  }
};

test("Users Module", async (t) => {
  await t.test("listDemoUsers should return all users without password field", () => {
    const users = listDemoUsers();
    assert.strictEqual(users.length, 3);
    for (const user of users) {
      assert.strictEqual(user.password, undefined);
      assert.ok(user.id);
      assert.ok(user.email);
      assert.ok(user.role);
      assert.ok(user.fullName);
    }
  });

  await t.test("findDemoUserByCredentials should return correct user or null", () => {
    const admin = findDemoUserByCredentials("admin@example.com", "admin123");
    assert.ok(admin);
    assert.strictEqual(admin.id, "demo-admin");
    assert.strictEqual(admin.role, "ADMIN");
    assert.strictEqual(admin.password, undefined);

    const lowercaseAdmin = findDemoUserByCredentials("  ADMIN@example.com  ", "admin123");
    assert.ok(lowercaseAdmin);
    assert.strictEqual(lowercaseAdmin.id, "demo-admin");

    const invalid = findDemoUserByCredentials("admin@example.com", "wrong-password");
    assert.strictEqual(invalid, null);

    const nonExistent = findDemoUserByCredentials("nonexistent@example.com", "admin123");
    assert.strictEqual(nonExistent, null);
  });

  await t.test("findDemoUserById should return user or null", () => {
    const staff = findDemoUserById("demo-staff");
    assert.ok(staff);
    assert.strictEqual(staff.id, "demo-staff");
    assert.strictEqual(staff.role, "STAFF");
    assert.strictEqual(staff.password, undefined);

    const invalid = findDemoUserById("non-existent-id");
    assert.strictEqual(invalid, null);
  });
});

test("JWT Module", async (t) => {
  const testUser = {
    id: "demo-admin",
    email: "admin@example.com",
    role: "ADMIN",
    fullName: "Admin Demo"
  };

  await t.test("signDemoJwt and verifyDemoJwt should work correctly for valid configuration", () => {
    const { token, expiresAt } = signDemoJwt(testUser, mockConfig);
    assert.ok(token);
    assert.ok(expiresAt);
    assert.strictEqual(typeof token, "string");
    
    // The token should have 3 parts separated by dots
    assert.strictEqual(token.split(".").length, 3);

    // Verifying token should return the user profile
    const verifiedUser = verifyDemoJwt(token, mockConfig);
    assert.ok(verifiedUser);
    assert.strictEqual(verifiedUser.id, testUser.id);
    assert.strictEqual(verifiedUser.email, testUser.email);
    assert.strictEqual(verifiedUser.role, testUser.role);
    assert.strictEqual(verifiedUser.fullName, testUser.fullName);
  });

  await t.test("verifyDemoJwt should reject invalid/expired/tampered tokens", () => {
    const { token } = signDemoJwt(testUser, mockConfig);

    // Tampered signature
    const parts = token.split(".");
    parts[2] = parts[2] + "extra";
    const tamperedToken = parts.join(".");
    assert.strictEqual(verifyDemoJwt(tamperedToken, mockConfig), null);

    // Invalid format
    assert.strictEqual(verifyDemoJwt("invalid-token-format", mockConfig), null);
    assert.strictEqual(verifyDemoJwt("a.b", mockConfig), null);

    // Expired token
    const expiredConfig = {
      auth: {
        jwtSecret: mockConfig.auth.jwtSecret,
        jwtExpiresInSeconds: -10 // expired 10 seconds ago
      }
    };
    const { token: expiredToken } = signDemoJwt(testUser, expiredConfig);
    assert.strictEqual(verifyDemoJwt(expiredToken, mockConfig), null);

    // Different secret key
    const otherConfig = {
      auth: {
        jwtSecret: "completely_different_secret_key_1234567890",
        jwtExpiresInSeconds: 3600
      }
    };
    assert.strictEqual(verifyDemoJwt(token, otherConfig), null);

    // Payload tampered / fake id not in DEMO_USERS
    const fakeUser = {
      id: "fake-id",
      email: "fake@example.com",
      role: "ADMIN",
      fullName: "Fake User"
    };
    const { token: fakeToken } = signDemoJwt(fakeUser, mockConfig);
    assert.strictEqual(verifyDemoJwt(fakeToken, mockConfig), null);
  });
});

test("Authorization Module", async (t) => {
  const adminUser = { id: "demo-admin", role: "ADMIN", email: "admin@example.com" };
  const staffUser = { id: "demo-staff", role: "STAFF", email: "staff@example.com" };
  const customerUser = { id: "demo-customer", role: "CUSTOMER", email: "customer@example.com" };

  await t.test("requireUser should allow user and throw UNAUTHORIZED on missing user", () => {
    // Valid context
    const context = { user: adminUser };
    assert.deepStrictEqual(requireUser(context), adminUser);

    // Invalid contexts
    const emptyContext = {};
    assert.throws(() => requireUser(emptyContext), (err) => {
      assert.ok(err instanceof GraphQLError);
      assert.strictEqual(err.message, "Authentication is required.");
      assert.strictEqual(err.extensions?.code, "UNAUTHORIZED");
      return true;
    });

    const nullUserContext = { user: null };
    assert.throws(() => requireUser(nullUserContext), (err) => {
      assert.ok(err instanceof GraphQLError);
      assert.strictEqual(err.message, "Authentication is required.");
      assert.strictEqual(err.extensions?.code, "UNAUTHORIZED");
      return true;
    });
  });

  await t.test("requireRole should enforce role constraints", () => {
    const adminContext = { user: adminUser };
    const staffContext = { user: staffUser };
    const customerContext = { user: customerUser };

    // Allowed role
    assert.deepStrictEqual(requireRole(adminContext, ["ADMIN", "STAFF"]), adminUser);
    assert.deepStrictEqual(requireRole(staffContext, ["ADMIN", "STAFF"]), staffUser);

    // Forbidden roles
    assert.throws(() => requireRole(customerContext, ["ADMIN", "STAFF"]), (err) => {
      assert.ok(err instanceof GraphQLError);
      assert.strictEqual(err.message, "This role is not allowed to access the resource.");
      assert.strictEqual(err.extensions?.code, "FORBIDDEN");
      return true;
    });
  });

  await t.test("requireAdmin should only allow ADMIN", () => {
    const adminContext = { user: adminUser };
    const staffContext = { user: staffUser };

    assert.deepStrictEqual(requireAdmin(adminContext), adminUser);
    assert.throws(() => requireAdmin(staffContext), (err) => {
      assert.ok(err instanceof GraphQLError);
      assert.strictEqual(err.extensions?.code, "FORBIDDEN");
      return true;
    });
  });

  await t.test("requireAdminOrStaff should allow ADMIN and STAFF but reject CUSTOMER", () => {
    const adminContext = { user: adminUser };
    const staffContext = { user: staffUser };
    const customerContext = { user: customerUser };

    assert.deepStrictEqual(requireAdminOrStaff(adminContext), adminUser);
    assert.deepStrictEqual(requireAdminOrStaff(staffContext), staffUser);
    assert.throws(() => requireAdminOrStaff(customerContext), (err) => {
      assert.ok(err instanceof GraphQLError);
      assert.strictEqual(err.extensions?.code, "FORBIDDEN");
      return true;
    });
  });
});

test("Context Module", async (t) => {
  const testUser = {
    id: "demo-admin",
    email: "admin@example.com",
    role: "ADMIN",
    fullName: "Admin Demo"
  };
  const { token } = signDemoJwt(testUser, mockConfig);
  const mockGrpc = {};

  await t.test("createContextFactory should extract and verify valid token", async () => {
    const contextFactory = createContextFactory(mockConfig, mockGrpc);
    const mockReq = {
      headers: {
        authorization: `Bearer ${token}`
      }
    };

    const context = await contextFactory({ req: mockReq });
    assert.ok(context.requestId);
    assert.strictEqual(context.authToken, token);
    assert.ok(context.user);
    assert.strictEqual(context.user.id, testUser.id);
    assert.strictEqual(context.user.role, testUser.role);
    assert.strictEqual(context.config, mockConfig);
    assert.strictEqual(context.grpc, mockGrpc);
  });

  await t.test("createContextFactory should set user to null for invalid or missing token", async () => {
    const contextFactory = createContextFactory(mockConfig, mockGrpc);

    // Missing authorization header
    const mockReqNoAuth = { headers: {} };
    const contextNoAuth = await contextFactory({ req: mockReqNoAuth });
    assert.strictEqual(contextNoAuth.authToken, null);
    assert.strictEqual(contextNoAuth.user, null);

    // Non-bearer authorization header
    const mockReqBasic = { headers: { authorization: "Basic base64creds" } };
    const contextBasic = await contextFactory({ req: mockReqBasic });
    assert.strictEqual(contextBasic.authToken, null);
    assert.strictEqual(contextBasic.user, null);

    // Invalid bearer token
    const mockReqInvalidToken = { headers: { authorization: "Bearer invalidtoken" } };
    const contextInvalidToken = await contextFactory({ req: mockReqInvalidToken });
    assert.strictEqual(contextInvalidToken.authToken, "invalidtoken");
    assert.strictEqual(contextInvalidToken.user, null);
  });
});
