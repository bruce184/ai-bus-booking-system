import {
  fetchAnalyticsDashboard,
  fetchPopularRoutes,
  fetchRevenueSummary
} from "../clients/analyticsClient.js";

export const analyticsResolvers = {
  Query: {
    adminRevenueSummary: async (_parent, { input }, context) => {
      requireAdmin(context);
      return fetchRevenueSummary(input);
    },
    adminAnalyticsDashboard: async (_parent, { input }, context) => {
      requireAdmin(context);
      return fetchAnalyticsDashboard(input);
    },
    popularRoutes: async (_parent, { limit }) => fetchPopularRoutes({ limit })
  }
};

function requireAdmin(context) {
  if (!context?.user || context.user.role !== "ADMIN") {
    const error = new Error("Admin access is required");
    error.extensions = { code: "FORBIDDEN" };
    throw error;
  }
}
