import { execFileSync, spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { estimateTokens } from "./eval-budget.mjs";
import { suiteById } from "./eval-suites.mjs";
import { validateFixtureSnapshot } from "./eval-fixtures.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");

export async function runContextGate({ suiteId = "north-star-v1", tasks, maxInputTokens = 24000, responseFraction = 0.25 } = {}) {
  const suite = suiteById(suiteId);
  const selectedTasks = tasks ?? suite.tasks;
  const threshold = Math.floor(maxInputTokens * responseFraction);
  const results = [];
  for (const task of selectedTasks) {
    results.push(await checkTask({ task, maxInputTokens, responseFraction }));
  }
  const failures = results.filter((result) => !result.passed);
  return {
    suite: suite.id,
    maxInputTokens,
    responseFraction,
    threshold,
    passed: failures.length === 0,
    results,
  };
}

export function evaluateContextResponse(query, { maxInputTokens = 24000, responseFraction = 0.25 } = {}) {
  const threshold = Math.floor(maxInputTokens * responseFraction);
  const errors = [];
  if (!query || typeof query !== "object") {
    errors.push("query_docs returned no structured response");
  }
  const estimatedTokens = Number(query?.estimatedTokens ?? estimateTokens(query ?? {}));
  if (estimatedTokens > threshold) {
    errors.push(`query_docs first response is ${estimatedTokens} tokens; offline gate threshold is ${threshold}`);
  }
  const refs = Array.isArray(query?.followUpRefs) ? query.followUpRefs : [];
  if (refs.some((ref) => typeof ref?.ref !== "string" || !ref.ref.startsWith("agentdocs://pages/"))) {
    errors.push("query_docs emitted a follow-up reference that is not a readable agentdocs page ref");
  }
  const fieldTokenEstimates = query && typeof query === "object" ? {
    steps: estimateTokens(query.steps ?? []),
    codeExamples: estimateTokens(query.codeExamples ?? []),
    gotchas: estimateTokens(query.gotchas ?? []),
    citations: estimateTokens(query.citations ?? []),
    followUpRefs: estimateTokens(query.followUpRefs ?? []),
    requirements: estimateTokens(query.requirements ?? []),
  } : {};
  return {
    passed: errors.length === 0,
    estimatedTokens,
    threshold,
    fieldTokenEstimates,
    errors,
  };
}

async function checkTask({ task, maxInputTokens, responseFraction }) {
  const taskDir = path.join(repositoryRoot, "fixtures", "eval-tasks", task);
  const validation = await validateFixtureSnapshot(taskDir);
  if (!validation.valid) {
    return { task, passed: false, errors: [`fixture invalid: ${validation.issues.join("; ")}`] };
  }
  const sandbox = await mkdtemp(path.join(os.tmpdir(), `agentdocs-context-gate-${task}-`));
  const outDir = path.join(sandbox, "agentdocs");
  try {
    const cliPath = path.join(repositoryRoot, "packages", "cli", "dist", "agentdocs.js");
    execFileSync(process.execPath, [cliPath, "--cwd", taskDir, "--out", outDir, "ingest", "./docs"], { cwd: repositoryRoot, stdio: "ignore" });
    execFileSync(process.execPath, [cliPath, "--cwd", taskDir, "--out", outDir, "build"], { cwd: repositoryRoot, stdio: "ignore" });
    const taskText = await readFile(path.join(taskDir, "task.md"), "utf8");
    const client = await startMcp(cliPath, taskDir, outDir);
    try {
      const response = await client.call("query_docs", { goal: taskText });
      const query = response?.structuredContent;
      const assessment = evaluateContextResponse(query, { maxInputTokens, responseFraction });
      if (response?.isError === true) assessment.errors.push(`query_docs returned an error: ${JSON.stringify(query)}`);
      return {
        task,
        ...assessment,
        stepCount: Array.isArray(query?.steps) ? query.steps.length : 0,
        requirementCount: Array.isArray(query?.requirements) ? query.requirements.length : 0,
        followUpRefCount: Array.isArray(query?.followUpRefs) ? query.followUpRefs.length : 0,
      };
    } finally {
      await client.stop();
    }
  } catch (error) {
    return { task, passed: false, errors: [error instanceof Error ? error.message : String(error)] };
  } finally {
    await rm(sandbox, { recursive: true, force: true }).catch(() => {});
  }
}

async function startMcp(cliPath, cwd, outDir) {
  const child = spawn(process.execPath, [cliPath, "--cwd", cwd, "--out", outDir, "serve-mcp", "--tools", "query_docs,read_page"], {
    cwd: repositoryRoot,
    stdio: ["pipe", "pipe", "ignore"],
    windowsHide: true,
  });
  const pending = new Map();
  let nextId = 0;
  let buffer = "";
  child.stdout.on("data", (chunk) => {
    buffer += chunk.toString();
    while (buffer.includes("\n")) {
      const newline = buffer.indexOf("\n");
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      const response = JSON.parse(line);
      const resolve = pending.get(response.id);
      if (resolve) {
        pending.delete(response.id);
        resolve(response);
      }
    }
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`MCP context gate timeout: ${method}`));
    }, 120000);
    pending.set(id, (response) => {
      clearTimeout(timeout);
      resolve(response);
    });
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  });
  await call("initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "eval-context-gate", version: "1.0.0" },
  });
  return {
    call: async (name, args) => (await call("tools/call", { name, arguments: args })).result,
    stop: async () => {
      child.kill();
    },
  };
}

function argValue(args, name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
}

if (process.argv[1]?.endsWith("eval-context-gate.mjs")) {
  const args = process.argv.slice(2);
  const suite = argValue(args, "--suite", "north-star-v1");
  const taskArg = argValue(args, "--tasks", undefined);
  const tasks = taskArg === undefined ? undefined : taskArg.split(",").map((value) => value.trim()).filter(Boolean);
  const maxInputTokens = Number(argValue(args, "--max-input-tokens", "24000"));
  const result = await runContextGate({ suiteId: suite, tasks, maxInputTokens });
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) process.exit(1);
}
