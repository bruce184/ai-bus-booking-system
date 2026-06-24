import { gatewayError } from "./errors.js";

export function requireUser(context) {
  if (!context.user) {
    throw gatewayError("Authentication is required.", "UNAUTHORIZED");
  }

  return context.user;
}

export function requireRole(context, allowedRoles) {
  const user = requireUser(context);

  if (!allowedRoles.includes(user.role)) {
    throw gatewayError("This role is not allowed to access the resource.", "FORBIDDEN");
  }

  return user;
}

export function requireAdmin(context) {
  return requireRole(context, ["ADMIN"]);
}

export function requireAdminOrStaff(context) {
  return requireRole(context, ["ADMIN", "STAFF"]);
}
