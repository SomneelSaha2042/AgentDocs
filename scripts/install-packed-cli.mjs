import { readdir } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const releaseDirectory = path.join(root, ".release");
const tarball = (await readdir(releaseDirectory))
  .find((file) => file.endsWith(".tgz"));
if (tarball === undefined) {
  throw new Error("No npm tarball found. Run pnpm pack:verify first.");
}

const result = spawnSync(
  "npm",
  ["install", "--global", path.join(releaseDirectory, tarball)],
  { cwd: root, encoding: "utf8", shell: process.platform === "win32", stdio: "inherit" },
);
if (result.status !== 0) {
  process.exitCode = result.status ?? 1;
}
