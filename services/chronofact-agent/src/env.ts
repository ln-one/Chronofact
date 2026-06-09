import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const serviceDir = resolve(moduleDir, "..");
const repoRoot = resolve(serviceDir, "..", "..");

export function loadRuntimeEnv() {
  for (const path of [
    join(repoRoot, ".env.local"),
    join(serviceDir, ".env.local"),
    join(repoRoot, ".env"),
    join(serviceDir, ".env")
  ]) {
    if (existsSync(path)) {
      config({ path, override: false, quiet: true });
    }
  }
}
