import { defineConfig, devices } from '@playwright/test';

const gatewayPort = Number(process.env.E2E_GATEWAY_PORT || 4100);
const webPort = Number(process.env.E2E_WEB_PORT || 3100);
const gatewayUrl = `http://localhost:${gatewayPort}/graphql`;
const webUrl = `http://localhost:${webPort}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: 'line',
  use: {
    baseURL: webUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npm --prefix ../../services/graphql-gateway run dev',
      url: gatewayUrl,
      env: {
        ...process.env,
        GRAPHQL_GATEWAY_PORT: String(gatewayPort)
      },
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command: `npm run dev -- --port ${webPort}`,
      url: webUrl,
      env: {
        ...process.env,
        NEXT_PUBLIC_APP_URL: webUrl,
        NEXT_PUBLIC_GRAPHQL_URL: gatewayUrl,
        NEXT_PUBLIC_GRAPHQL_WS_URL: `ws://localhost:${gatewayPort}/graphql`
      },
      reuseExistingServer: false,
      timeout: 120000,
    }
  ],
});
