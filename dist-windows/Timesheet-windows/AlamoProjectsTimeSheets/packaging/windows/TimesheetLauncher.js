/* eslint-disable no-console */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync, spawn } = require("node:child_process");

const APP_BASE_DIR = path.dirname(process.execPath);
const PROJECT_DIR = path.join(APP_BASE_DIR, "AlamoProjectsTimeSheets");
const LOG_DIR = path.join(os.homedir(), "AppData", "Local", "Timesheet", "Logs");
const LAUNCH_LOG = path.join(LOG_DIR, "launcher.log");

function now() {
  return new Date().toISOString();
}

function log(message) {
  const line = `[${now()}] ${message}`;
  console.log(line);
  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.appendFileSync(LAUNCH_LOG, `${line}\n`);
}

function fail(message) {
  log(message);
  process.exit(1);
}

function runChecked(command, args, options = {}) {
  log(`Running: ${command} ${args.join(" ")}`);

  const result = spawnSync(command, args, {
    stdio: "pipe",
    encoding: "utf8",
    ...options
  });

  if (result.stdout) {
    fs.appendFileSync(LAUNCH_LOG, result.stdout);
  }
  if (result.stderr) {
    fs.appendFileSync(LAUNCH_LOG, result.stderr);
  }

  if (result.error) {
    throw result.error;
  }

  if (typeof result.status === "number" && result.status !== 0) {
    throw new Error(`${command} exited with code ${result.status}`);
  }
}

function hasCommand(command, args = ["--version"]) {
  const result = spawnSync(command, args, {
    stdio: "ignore",
    shell: false
  });
  return result.status === 0;
}

function openBrowser(url) {
  spawnSync("cmd.exe", ["/c", "start", "", url], { stdio: "ignore" });
}

function ensureEnvFile() {
  const envFile = path.join(PROJECT_DIR, "infra", "env", ".env.staging");
  const envExample = path.join(PROJECT_DIR, "infra", "env", ".env.staging.example");

  if (!fs.existsSync(envFile) && fs.existsSync(envExample)) {
    fs.copyFileSync(envExample, envFile);
    log("Created infra/env/.env.staging from example.");
  }
}

function ensureNodeModules() {
  const nodeModules = path.join(PROJECT_DIR, "node_modules");
  if (fs.existsSync(nodeModules)) {
    return;
  }

  runChecked("npm", ["install"], { cwd: PROJECT_DIR });
}

function runDockerStack() {
  if (!hasCommand("docker", ["version"])) {
    log("Docker not available.");
    return false;
  }

  try {
    runChecked(
      "docker",
      [
        "compose",
        "-f",
        "infra/docker-compose.staging.yml",
        "--env-file",
        "infra/env/.env.staging",
        "up",
        "-d",
        "--build"
      ],
      { cwd: PROJECT_DIR }
    );
    runChecked(
      "docker",
      [
        "compose",
        "-f",
        "infra/docker-compose.staging.yml",
        "--env-file",
        "infra/env/.env.staging",
        "run",
        "--rm",
        "api-migrate"
      ],
      { cwd: PROJECT_DIR }
    );
    runChecked(
      "docker",
      [
        "compose",
        "-f",
        "infra/docker-compose.staging.yml",
        "--env-file",
        "infra/env/.env.staging",
        "run",
        "--rm",
        "api-seed"
      ],
      { cwd: PROJECT_DIR }
    );
    openBrowser("http://localhost");
    log("Started Docker staging stack at http://localhost");
    return true;
  } catch (error) {
    log(`Docker staging startup failed: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

function runFrontendOnly() {
  const command = `cd /d "${PROJECT_DIR}" && npm run build --workspace @timesheet/shared && npm run dev --workspace @timesheet/web`;
  spawn("cmd.exe", ["/c", "start", "", "cmd", "/k", command], {
    detached: true,
    stdio: "ignore"
  }).unref();
  openBrowser("http://localhost:3000");
  log("Started frontend-only mode at http://localhost:3000");
}

function main() {
  log("Windows launcher started.");

  if (!fs.existsSync(PROJECT_DIR)) {
    fail(`Project payload is missing at ${PROJECT_DIR}`);
  }

  if (!hasCommand("npm")) {
    fail("Node.js/npm not found. Install Node.js 20+ and run again.");
  }

  ensureEnvFile();
  ensureNodeModules();

  if (!runDockerStack()) {
    runFrontendOnly();
  }
}

main();
