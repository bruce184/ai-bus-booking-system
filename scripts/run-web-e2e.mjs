import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
let activeChild = null;

function positivePort(env, name, fallback) {
  const value = Number(env[name] || fallback);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return String(value);
}

export function buildE2EPlan(env = process.env) {
  const composeProject =
    env.E2E_COMPOSE_PROJECT || "ai-bus-booking-e2e";
  const ports = {
    postgres: positivePort(env, "E2E_POSTGRES_PORT", 15432),
    redis: positivePort(env, "E2E_REDIS_PORT", 16379),
    rabbitmq: positivePort(env, "E2E_RABBITMQ_PORT", 25672),
    rabbitmqManagement: positivePort(
      env,
      "E2E_RABBITMQ_MANAGEMENT_PORT",
      25673
    ),
    zookeeper: positivePort(env, "E2E_ZOOKEEPER_PORT", 12181),
    kafka: positivePort(env, "E2E_KAFKA_PORT", 29092)
  };
  const runEnv = {
    ...env,
    POSTGRES_PORT: ports.postgres,
    REDIS_PORT: ports.redis,
    RABBITMQ_PORT: ports.rabbitmq,
    RABBITMQ_MANAGEMENT_PORT: ports.rabbitmqManagement,
    ZOOKEEPER_PORT: ports.zookeeper,
    KAFKA_PORT: ports.kafka,
    DATABASE_URL:
      `postgresql://bus_app:change_me_local_only@localhost:${ports.postgres}/bus_booking`,
    REDIS_URL: `redis://localhost:${ports.redis}`,
    RABBITMQ_URL: `amqp://localhost:${ports.rabbitmq}`,
    KAFKA_BROKERS: `localhost:${ports.kafka}`,
    KAFKA_GROUP_ID:
      `${env.KAFKA_GROUP_ID || "analytics-service"}-e2e`
  };

  return {
    composeProject,
    env: runEnv,
    up: [
      "compose",
      "-p",
      composeProject,
      "up",
      "-d",
      "--wait",
      "postgres",
      "redis",
      "rabbitmq",
      "zookeeper",
      "kafka"
    ],
    test: ["--prefix", "apps/web", "run", "test:e2e"],
    down: [
      "compose",
      "-p",
      composeProject,
      "down",
      "-v",
      "--remove-orphans"
    ]
  };
}

function executeCommand(command, args, env) {
  return new Promise((resolve, reject) => {
    // Windows can't exec a .cmd file directly (it's not a native PE binary);
    // it needs the command interpreter. Node's spawn(shell:false) throws
    // EINVAL for npm.cmd here rather than auto-detecting this, unlike a real
    // .exe (docker) which runs fine either way.
    const needsShell = process.platform === "win32" && /\.cmd$/i.test(command);
    const child = spawn(command, args, {
      cwd: repoRoot,
      env,
      stdio: "inherit",
      shell: needsShell
    });
    activeChild = child;
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (activeChild === child) {
        activeChild = null;
      }
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `${command} ${args.join(" ")} failed${signal
            ? ` with signal ${signal}`
            : ` with exit code ${code}`}`
        )
      );
    });
  });
}

export async function runHermeticWebE2E(
  env = process.env,
  {
    execute = executeCommand,
    dockerCommand = "docker",
    npmCommand = process.platform === "win32" ? "npm.cmd" : "npm"
  } = {}
) {
  const plan = buildE2EPlan(env);
  let failure = null;
  try {
    await execute(dockerCommand, plan.up, plan.env);
    await execute(npmCommand, plan.test, plan.env);
  } catch (error) {
    failure = error;
  }

  try {
    await execute(dockerCommand, plan.down, plan.env);
  } catch (cleanupError) {
    if (!failure) {
      failure = cleanupError;
    } else {
      console.error(
        `[e2e] cleanup also failed: ${cleanupError.message}`
      );
    }
  }

  if (failure) {
    throw failure;
  }
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  let receivedSignal = null;
  const interrupt = (signal) => {
    receivedSignal = signal;
    activeChild?.kill(signal);
  };
  const onSigint = () => interrupt("SIGINT");
  const onSigterm = () => interrupt("SIGTERM");
  process.once("SIGINT", onSigint);
  process.once("SIGTERM", onSigterm);

  try {
    await runHermeticWebE2E();
  } catch (error) {
    if (!receivedSignal) {
      console.error(`[e2e] ${error.message}`);
      process.exitCode = 1;
    }
  } finally {
    process.off("SIGINT", onSigint);
    process.off("SIGTERM", onSigterm);
  }

  if (receivedSignal) {
    process.exitCode = receivedSignal === "SIGINT" ? 130 : 143;
  }
}
