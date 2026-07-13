import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEV_SERVICE_TARGETS = [
  { name: "Web", type: "http", url: "http://localhost:3000" },
  { name: "GraphQL Gateway", type: "http", url: "http://localhost:4000/graphql" },
  { name: "Trip Service", type: "tcp", host: "localhost", port: 50051 },
  { name: "Seat Inventory Service", type: "tcp", host: "localhost", port: 50052 },
  { name: "Booking Service", type: "tcp", host: "localhost", port: 50053 },
  { name: "Payment Service", type: "http", url: "http://localhost:5010/health" },
  { name: "Analytics Service", type: "http", url: "http://localhost:50056/health" },
  { name: "MCP Server", type: "http", url: "http://localhost:4010/health" }
];

export async function probeHttp(target, timeoutMs = 2_000) {
  const response = await fetch(target.url, {
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (response.status >= 500) {
    throw new Error(`HTTP ${response.status}`);
  }
}

export function probeTcp(target, timeoutMs = 2_000) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: target.host, port: target.port });
    const finish = (error) => {
      socket.destroy();
      error ? reject(error) : resolve();
    };
    socket.setTimeout(timeoutMs, () => finish(new Error("TCP probe timed out")));
    socket.once("connect", () => finish());
    socket.once("error", finish);
  });
}

export function probeTarget(target, timeoutMs) {
  return target.type === "http"
    ? probeHttp(target, timeoutMs)
    : probeTcp(target, timeoutMs);
}

export async function waitForTargets(
  targets,
  {
    timeoutMs = 120_000,
    intervalMs = 500,
    probe = probeTarget,
    onRetry = () => {}
  } = {}
) {
  const deadline = Date.now() + timeoutMs;
  let pending = targets;

  while (pending.length > 0) {
    const checks = await Promise.all(
      pending.map(async (target) => {
        try {
          await probe(target);
          return null;
        } catch {
          return target;
        }
      })
    );
    pending = checks.filter(Boolean);
    if (pending.length === 0) {
      return;
    }
    if (Date.now() >= deadline) {
      throw new Error(`Services not ready: ${pending.map((target) => target.name).join(", ")}`);
    }
    onRetry(pending);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

function printReadyBanner() {
  console.log(`
===================================================
SYSTEM IS READY FOR DEMO (health checks passed)
===================================================
Web App:          http://localhost:3000
GraphQL Gateway: http://localhost:4000/graphql
Admin Dashboard: http://localhost:3000/admin/login
===================================================`);
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    await waitForTargets(DEV_SERVICE_TARGETS, {
      onRetry: (pending) => console.log(`[readiness] waiting for ${pending.map((item) => item.name).join(", ")}`)
    });
    printReadyBanner();
    if (process.argv.includes("--keep-alive")) {
      setInterval(() => {}, 3_600_000);
    }
  } catch (error) {
    console.error(`[readiness] ${error.message}`);
    process.exitCode = 1;
  }
}
