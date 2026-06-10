import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const packageRoot = path.join(root, "packages", "cli");
const releaseDirectory = path.join(root, ".release");
const stagedPackage = path.join(releaseDirectory, "package");

await rm(releaseDirectory, { recursive: true, force: true });
await mkdir(releaseDirectory, { recursive: true });
run("node", [path.join(packageRoot, "scripts", "build-package.mjs")]);
run("node", [path.join(root, "scripts", "stage-release-package.mjs")]);

const result = spawnSync("npm", ["pack", stagedPackage, "--json", "--pack-destination", releaseDirectory], {
  cwd: root,
  encoding: "utf8",
  shell: process.platform === "win32",
});
if (result.status !== 0) {
  throw new Error(result.stderr || result.stdout || "npm pack failed.");
}

const packed = JSON.parse(result.stdout);
const files = packed[0]?.files?.map((entry) => entry.path).sort() ?? [];
const expected = ["LICENSE", "README.md", "dist/agentdocs.js", "package.json"];
if (JSON.stringify(files) !== JSON.stringify(expected)) {
  throw new Error(`Unexpected npm package contents:\n${files.join("\n")}`);
}

const packageJson = JSON.parse(await readFile(path.join(stagedPackage, "package.json"), "utf8"));
if (packageJson.dependencies !== undefined || packageJson.devDependencies !== undefined) {
  throw new Error("Published package metadata must not contain dependency sections.");
}
if (packageJson.scripts !== undefined) {
  throw new Error("Published package metadata must not contain workspace scripts.");
}

process.stdout.write(
  `Verified ${packed[0].filename}: ${files.length} files, ${packed[0].size} bytes, no workspace runtime dependencies.\n`,
);

function run(command, args) {
  const child = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: "inherit",
  });
  if (child.status !== 0) {
    process.exit(child.status ?? 1);
  }
}
