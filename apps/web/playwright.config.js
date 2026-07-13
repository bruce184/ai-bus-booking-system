import { defineConfig, devices } from "@playwright/test";

function port(name, fallback) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

const gatewayPort = port("E2E_GATEWAY_PORT", 4100);
const webPort = port("E2E_WEB_PORT", 3100);
const tripPort = port("E2E_TRIP_PORT", 51051);
const seatPort = port("E2E_SEAT_PORT", 51052);
const bookingPort = port("E2E_BOOKING_PORT", 51053);
const paymentPort = port("E2E_PAYMENT_PORT", 15010);
const analyticsPort = port("E2E_ANALYTICS_PORT", 15056);
const gatewayUrl = `http://localhost:${gatewayPort}/graphql`;
const webUrl = `http://localhost:${webPort}`;
const commonEnv = {
  ...process.env,
  TRIP_SERVICE_PORT: String(tripPort),
  SEAT_INVENTORY_SERVICE_PORT: String(seatPort),
  BOOKING_SERVICE_PORT: String(bookingPort),
  PAYMENT_SERVICE_PORT: String(paymentPort),
  ANALYTICS_SERVICE_PORT: String(analyticsPort),
  TRIP_SERVICE_GRPC_ADDRESS: `localhost:${tripPort}`,
  SEAT_INVENTORY_SERVICE_GRPC_ADDRESS: `localhost:${seatPort}`,
  BOOKING_SERVICE_GRPC_ADDRESS: `localhost:${bookingPort}`,
  PAYMENT_SERVICE_URL: `http://localhost:${paymentPort}`,
  ANALYTICS_SERVICE_URL: `http://localhost:${analyticsPort}`
};

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: "line",
  use: {
    baseURL: webUrl,
    trace: "on-first-retry",
    screenshot: "only-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  webServer: [
    {
      command: "npm --prefix ../../services/trip-service run start",
      port: tripPort,
      env: commonEnv,
      reuseExistingServer: false,
      timeout: 120_000
    },
    {
      command: "npm --prefix ../../services/seat-inventory-service run dev",
      port: seatPort,
      env: commonEnv,
      reuseExistingServer: false,
      timeout: 120_000
    },
    {
      command: "npm --prefix ../../services/booking-service run start",
      port: bookingPort,
      env: commonEnv,
      reuseExistingServer: false,
      timeout: 120_000
    },
    {
      command: "npm --prefix ../../services/payment-service run start",
      url: `http://localhost:${paymentPort}/health`,
      env: commonEnv,
      reuseExistingServer: false,
      timeout: 120_000
    },
    {
      command: "npm --prefix ../../services/analytics-service run start",
      url: `http://localhost:${analyticsPort}/health`,
      env: commonEnv,
      reuseExistingServer: false,
      timeout: 120_000
    },
    {
      command: "npm --prefix ../../services/graphql-gateway run start",
      url: gatewayUrl,
      env: {
        ...commonEnv,
        GRAPHQL_GATEWAY_PORT: String(gatewayPort),
        WEB_ORIGIN: webUrl
      },
      reuseExistingServer: false,
      timeout: 120_000
    },
    {
      command: `npm run dev -- --port ${webPort}`,
      url: webUrl,
      env: {
        ...commonEnv,
        GRAPHQL_GATEWAY_URL: gatewayUrl,
        NEXT_PUBLIC_APP_URL: webUrl,
        NEXT_PUBLIC_GRAPHQL_URL: gatewayUrl,
        NEXT_PUBLIC_GRAPHQL_WS_URL:
          `ws://localhost:${gatewayPort}/graphql`
      },
      reuseExistingServer: false,
      timeout: 120_000
    }
  ]
});
