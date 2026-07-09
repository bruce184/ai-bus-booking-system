import { execSync } from "node:child_process";

try {
  console.log("[package-audit] Checking for package vulnerabilities...");
  // npm audit exits with non-zero if vulnerabilities are found
  execSync("npm audit", { stdio: "ignore" });
  console.log("[package-audit] No vulnerabilities found.");
} catch (error) {
  console.log("[package-audit] Vulnerabilities detected! Attempting to run 'npm audit fix'...");
  try {
    execSync("npm audit fix", { stdio: "inherit" });
    console.log("[package-audit] Package audit fix completed successfully.");
  } catch (fixError) {
    console.error("[package-audit] Failed to automatically run 'npm audit fix':", fixError.message);
  }
}
