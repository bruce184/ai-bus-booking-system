import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const roots = ["apps", "packages", "services", "workers", "scripts"];
const skippedDirectories = new Set([
  ".git",
  ".next",
  "node_modules",
  "playwright-report",
  "test-results"
]);
const sourceExtensions = new Set([".js", ".jsx", ".mjs"]);
const syntaxExtensions = new Set([".js", ".mjs"]);
const resolutionExtensions = ["", ".js", ".jsx", ".mjs", ".json", ".css"];
const importPatterns = [
  /\b(?:from\s+|import\s*(?:\(\s*)?)(["'])(\.[^"']+)\1/g,
  /\brequire\s*\(\s*(["'])(\.[^"']+)\1\s*\)/g
];

function collectFiles(path, files = []) {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (entry.isDirectory() && skippedDirectories.has(entry.name)) continue;
    const fullPath = join(path, entry.name);
    if (entry.isDirectory()) collectFiles(fullPath, files);
    else if (sourceExtensions.has(extname(entry.name))) files.push(fullPath);
  }
  return files;
}

function resolvesRelativeImport(file, specifier) {
  const base = resolve(dirname(file), specifier);
  const candidates = resolutionExtensions.flatMap((extension) => [
    `${base}${extension}`,
    join(base, `index${extension}`)
  ]);
  return candidates.some((candidate) => {
    try {
      return statSync(candidate).isFile();
    } catch {
      return false;
    }
  });
}

const files = roots.flatMap((root) => collectFiles(root));
const failures = [];

for (const file of files) {
  const normalizedFile = file.replaceAll("\\", "/");
  if (syntaxExtensions.has(extname(file)) && !normalizedFile.startsWith("apps/web/")) {
    const check = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
    if (check.status !== 0) {
      failures.push(`${file}: ${check.stderr.trim() || "node --check failed"}`);
    }
  }

  const source = readFileSync(file, "utf8");
  const isTestSource =
    normalizedFile.includes("/tests/") ||
    normalizedFile.includes("/unit/") ||
    normalizedFile.endsWith(".test.js") ||
    normalizedFile.endsWith(".test.mjs");
  if (
    /\bfetch\s*\(/.test(source) &&
    normalizedFile !== "packages/shared/src/http.js" &&
    !isTestSource
  ) {
    failures.push(
      `${file}: unbounded native HTTP call is forbidden; use @bus/shared/http.js`
    );
  }
  for (const importPattern of importPatterns) {
    for (const match of source.matchAll(importPattern)) {
      if (!resolvesRelativeImport(file, match[2])) {
        failures.push(`${file}: missing relative import ${match[2]}`);
      }
    }
  }
}

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const dependencyTree = spawnSync(
  npmCommand,
  ["ls", "--all", "--omit=optional", "--silent"],
  { encoding: "utf8", shell: process.platform === "win32" }
);
if (dependencyTree.status !== 0) {
  failures.push(
    `npm dependency tree is invalid:\n${dependencyTree.stdout || ""}\n${
      dependencyTree.stderr || dependencyTree.error?.message || ""
    }`
  );
}

if (failures.length > 0) {
  console.error(failures.join("\n\n"));
  process.exit(1);
}

console.log(`Source integrity passed: ${files.length} files, relative imports resolved, dependency tree valid.`);
