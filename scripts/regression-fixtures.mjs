import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const target = await mkdtemp(path.join(os.tmpdir(), "agentdocs-regression-fixtures-"));
const cli = path.join(root, "packages", "cli", "dist", "agentdocs.js");
await writeFile(path.join(target, "agentdocs.config.yaml"), `name: Hardening Fixtures
slug: hardening-fixtures
sources:
  - type: local_markdown
    path: ${JSON.stringify(path.join(root, "fixtures", "hardening").replaceAll("\\", "/"))}
context:
  preferred:
    version: v5
    framework: react
    router: app
  exclusiveKeys: [version, framework, router, runtime]
normalization:
  mdx: tolerant
doctor:
  minScore: 0
`, "utf8");

await run(["--cwd", target, "--json", "build"]);
const migration = await json(["--cwd", target, "--json", "search", "migration", "--facet", "version=v5"]);
const react = await json(["--cwd", target, "--json", "search", "query invalidation", "--facet", "framework=react"]);
const app = await json(["--cwd", target, "--json", "search", "route handler", "--facet", "router=app"]);
const mixed = await json(["--cwd", target, "--json", "search", "migration"]);
const map = JSON.parse(await readFile(path.join(target, ".agentdocs", "agent-map.json"), "utf8"));
const manifest = JSON.parse(await readFile(path.join(target, ".agentdocs", "sources", "ingest-manifest.json"), "utf8"));

assert(migration.results.length > 0 && migration.results.every((result) => hasFacet(result, "version", "v5")), "v5 migration filter returned no evidence or mixed versions");
assert(react.results.length > 0 && react.results.every((result) => hasFacet(result, "framework", "react")), "React filter returned no evidence or mixed frameworks");
assert(app.results.length > 0 && app.results.every((result) => hasFacet(result, "router", "app")), "App Router filter returned no evidence or mixed routers");
assert(mixed.warnings.some((warning) => warning.code === "context_conflict" && warning.key === "version"), "unfiltered migration did not warn");
assert(map.taskPacks.some((pack) => pack.id === "quickstart"), "quickstart task pack missing");
assert(manifest.counts.degraded > 0, "tolerant MDX fixture was not reported degraded");

await runNode(path.join(root, "scripts", "dogfood-regression.mjs"), [
  target,
  "--results", "dogfood-results",
  "--matrix", path.join(target, "dogfood-matrix.csv"),
  "--query", "migration=migration",
  "--expect-warning", "migration=context_conflict",
  "--expect-task-pack", "quickstart",
]);
const dogfood = JSON.parse(await readFile(path.join(target, "dogfood-results", "summary.json"), "utf8"));
assert(dogfood.assertions.failed === 0, "dogfood assertion runner reported a failed expectation");

process.stdout.write("Offline hardening fixture regression passed.\n");

function hasFacet(result, key, value) {
  return result.facets.some((facet) => facet.key === key && facet.value === value);
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
async function json(args) {
  return JSON.parse(await run(args));
}
async function run(args) {
  return runNode(cli, args);
}
async function runNode(entry, args) {
  const child = spawn(process.execPath, [entry, ...args], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const code = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  if (code !== 0) throw new Error(`${stdout}${stderr}`);
  return stdout;
}
