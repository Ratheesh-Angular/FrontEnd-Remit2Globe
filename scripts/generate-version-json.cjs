"use strict";

const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.join(__dirname, "..");
const pkg = require(path.join(rootDir, "package.json"));

function runGit(command) {
  try {
    return execSync(`git ${command}`, {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function resolveEnvironment() {
  const explicit =
    process.env.DEPLOY_ENV?.trim() || process.env.APP_ENV?.trim();
  if (explicit) return explicit;
  return process.env.NODE_ENV === "production" ? "Production" : "Development";
}

const payload = {
  version: pkg.version ?? "0.0.0",
  commit: runGit("rev-parse --short HEAD") ?? "unknown",
  branch: runGit("rev-parse --abbrev-ref HEAD") ?? "unknown",
  buildTime: new Date().toISOString(),
  environment: resolveEnvironment(),
};

const outPath = path.join(rootDir, "public", "version.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

console.log(`[generate-version-json] wrote ${outPath}`);
