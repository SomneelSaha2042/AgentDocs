import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_MAX_INPUT_TOKENS,
  DEFAULT_MAX_OUTPUT_TOKENS,
} from "./eval-budget.mjs";
import {
  parseSeedList,
  plannedRuns,
  resultDirectoryFor,
  suiteById,
} from "./eval-suites.mjs";
import { validateFixtureSnapshot } from "./eval-fixtures.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");

async function main() {
  const args = process.argv.slice(2);
  const suite = suiteById(getArg(args, "--suite") || "north-star-v1");
  const seeds = getArg(args, "--seeds") ? parseSeedList(getArg(args, "--seeds")) : suite.seeds;
  const provider = getArg(args, "--provider") || suite.provider;
  const model = getArg(args, "--model") || suite.model;
  const maxCost = Number(getArg(args, "--max-cost") || suite.maxCost);
  const maxInputTokens = positiveInteger(
    getArg(args, "--max-input-tokens") || suite.maxInputTokens || DEFAULT_MAX_INPUT_TOKENS,
    "--max-input-tokens",
  );
  const maxOutputTokens = positiveInteger(
    getArg(args, "--max-output-tokens") || suite.maxOutputTokens || DEFAULT_MAX_OUTPUT_TOKENS,
    "--max-output-tokens",
  );
  if (!Number.isFinite(maxCost) || maxCost <= 0) {
    throw new Error("--max-cost must be a positive number");
  }
  if (maxCost > suite.maxCost) {
    throw new Error(`--max-cost cannot exceed the suite cap of $${suite.maxCost.toFixed(2)}`);
  }
  const runId = getArg(args, "--run-id") || defaultRunId();
  const resultsDir = path.resolve(repositoryRoot, resultDirectoryFor(suite.id, runId));
  const dryRun = args.includes("--dry-run");

  const validations = [];
  for (const task of suite.tasks) {
    const taskDir = path.join(repositoryRoot, "fixtures", "eval-tasks", task);
    const validation = await validateFixtureSnapshot(taskDir);
    validations.push(validation);
    if (!validation.valid) {
      throw new Error(`${task} fixture is not eligible: ${validation.issues.join("; ")}`);
    }
  }

  const runs = plannedRuns(suite, { seeds });
  await mkdir(resultsDir, { recursive: true });
  await writeFile(path.join(resultsDir, "suite-manifest.json"), `${JSON.stringify({
    schemaVersion: 2,
    suite: suite.id,
    runId,
    provider,
    model,
    maxCost,
    tokenBudget: { maxInputTokens, maxOutputTokens },
    dryRun,
    mcpTools: suite.mcpTools,
    gitCommit: gitCommit(),
    validations,
    plannedRuns: runs,
  }, null, 2)}\n`, "utf8");

  console.log(`Running ${runs.length} evaluations for ${suite.id}.`);
  console.log(`Results: ${path.relative(repositoryRoot, resultsDir)}`);
  for (const run of runs) {
    const childArgs = [
      path.join("scripts", "eval-runner.mjs"),
      "--task", run.task,
      "--group", run.group,
      "--seed", String(run.seed),
      "--provider", provider,
      "--model", model,
      "--max-cost", String(maxCost),
      "--max-input-tokens", String(maxInputTokens),
      "--max-output-tokens", String(maxOutputTokens),
      "--mcp-tools", suite.mcpTools,
      "--run-id", runId,
      "--results-dir", resultsDir,
    ];
    if (dryRun) childArgs.push("--dry-run");
    console.log(`\n=== ${run.task} / ${run.group} / seed ${run.seed} ===`);
    execFileSync(process.execPath, childArgs, {
      cwd: repositoryRoot,
      stdio: "inherit",
      windowsHide: true,
    });
  }
  console.log(`\nSuite complete. Aggregate with: node scripts/aggregate-metrics.mjs --results-dir ${path.relative(repositoryRoot, resultsDir)} ${suite.tasks.join(" ")}`);
}

function gitCommit() {
  try {
    return execFileSync("git", ["-c", `safe.directory=${repositoryRoot}`, "rev-parse", "HEAD"], { cwd: repositoryRoot, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function defaultRunId() {
  return new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
}

function getArg(args, key) {
  const index = args.indexOf(key);
  return index >= 0 ? args[index + 1] : null;
}

function positiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

if (process.argv[1]?.endsWith("eval-suite-runner.mjs")) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
