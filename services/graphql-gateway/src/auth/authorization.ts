import type { CurrentUser, GatewayContext } from "../server/context.js";
import { gatewayError } from "./errors.js";
import type { UserRole } from "./users.js";

export function requireUser(context: GatewayContext): CurrentUser {
  if (!context.user) {
    throw gatewayError("Authentication is required.", "UNAUTHORIZED");
  }

  return context.user;
}

export function requireRole(context: GatewayContext, allowedRoles: readonly UserRole[]): CurrentUser {
  const user = requireUser(context);

  if (!allowedRoles.includes(user.role)) {
    throw gatewayError("This role is not allowed to access the resource.", "FORBIDDEN");
  }

  return user;
}

export function requireAdmin(context: GatewayContext): CurrentUser {
  return requireRole(context, ["ADMIN"]);
}

export function requireAdminOrStaff(context: GatewayContext): CurrentUser {
  return requireRole(context, ["ADMIN", "STAFF"]);
}
