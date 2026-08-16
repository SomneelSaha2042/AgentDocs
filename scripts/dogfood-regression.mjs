import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const options = parseOptions(process.argv.slice(2));
const target = path.resolve(options.target);
const resultsDirectory = options.results === undefined
  ? path.resolve(target, options.out ?? ".", "results")
  : path.resolve(target, options.results);
const matrixPath = path.resolve(repositoryRoot, options.matrix);
const command = process.execPath;
const commandPrefix = [path.join(repositoryRoot, "packages", "cli", "dist", "agentdocs.js")];
const globals = ["--cwd", target, "--json", ...(options.out === undefined ? [] : ["--out", options.out])];

await mkdir(resultsDirectory, { recursive: true });
await rm(path.join(resultsDirectory, "failure.json"), { force: true });

const startFirstBuild = performance.now();
const firstBuild = JSON.parse(await run([...globals, "build"]));
const durationFirstBuild = Math.round(performance.now() - startFirstBuild);
const doctor = JSON.parse(await run([...globals, "doctor"]));
const standardSearches = {
  authentication: JSON.parse(await run([...globals, "search", "authentication", "--limit", "5"])),
  quickstart: JSON.parse(await run([...globals, "search", "quickstart", "--limit", "5"])),
  errors: JSON.parse(await run([...globals, "search", "error handling", "--limit", "5"])),
};
const customSearches = Object.fromEntries(await Promise.all(options.queries.map(async ({ label, query }) => [
  label,
  JSON.parse(await run([...globals, "search", query, "--limit", "5"])),
])));
const searches = { ...standardSearches, ...customSearches };
const routing = await evaluateRouting(options);

await writeJson(path.join(resultsDirectory, "build.json"), firstBuild);
await writeJson(path.join(resultsDirectory, "doctor.json"), doctor);
await writeJson(path.join(resultsDirectory, "search-auth.json"), searches.authentication);
await writeJson(path.join(resultsDirectory, "search-quickstart.json"), searches.quickstart);
await writeJson(path.join(resultsDirectory, "search-errors.json"), searches.errors);
for (const [label, response] of Object.entries(customSearches)) {
  await writeJson(path.join(resultsDirectory, `search-${label}.json`), response);
}

const outputRoot = path.dirname(firstBuild.agentMapPath);
const firstHashes = await artifactHashes(outputRoot);
const startSecondBuild = performance.now();
const secondBuild = JSON.parse(await run([...globals, "build"]));
const durationSecondBuild = Math.round(performance.now() - startSecondBuild);
const secondHashes = await artifactHashes(outputRoot);
const repeatedBuildStable = JSON.stringify(firstHashes) === JSON.stringify(secondHashes);
const agentMap = JSON.parse(await readFile(firstBuild.agentMapPath, "utf8"));
const brokenLinks = agentMap.pages.flatMap((page) =>
  page.links
    .filter((link) => link.kind === "internal" && link.isBroken === true)
    .map((link) => ({
      pageId: page.id,
      source: page.canonicalUrl ?? page.sourceUrl ?? page.repoPath,
      href: link.href,
    })),
);
const deprecated = agentMap.entities.filter(
  (entity) => entity.type === "concept" && /deprecated/i.test(entity.name),
);
const assertions = evaluateAssertions(options, searches, agentMap, routing);
const warnings = doctor.checks.filter((check) => check.status === "warn");
const summary = {
  target: options.name ?? path.basename(target),
  targetPath: target,
  outputRoot,
  counts: {
    pages: firstBuild.pageCount,
    chunks: firstBuild.chunkCount,
    entities: firstBuild.entityCount,
    taskPacks: firstBuild.taskPackCount,
  },
  readinessScore: doctor.score,
  brokenLinks: {
    count: brokenLinks.length,
    findings: brokenLinks,
  },
  warnings: {
    count: warnings.length,
    findings: warnings.map((check) => ({ id: check.id, message: check.message })),
  },
  sourceCoverage: firstBuild.sourceCoverage ?? {
    gapReason: "historical_metric_not_captured",
    gapSeverity: "warn",
    message: "Source coverage was not captured for this build.",
  },
  deprecations: {
    count: deprecated.length,
    findings: deprecated.map((entity) => ({ id: entity.id, name: entity.name })),
  },
  topSearchResults: Object.fromEntries(
    Object.entries(searches).map(([query, response]) => [
      query,
      response.results.slice(0, 5).map((result) => ({
        pageId: result.pageId,
        chunkId: result.chunkId,
        title: result.title,
        source: result.sourceUrl ?? result.repoPath,
        score: result.score,
      })),
    ]),
  ),
  performance: {
    buildColdStartMs: durationFirstBuild,
    buildIncrementalMs: durationSecondBuild,
  },
  repeatedBuild: {
    stable: repeatedBuildStable,
    firstHash: aggregateHash(firstHashes),
    secondHash: aggregateHash(secondHashes),
    artifactHashes: secondHashes,
  },
  judgments: {
    searchAuthGood: options.searchAuthGood,
    searchQuickstartGood: options.searchQuickstartGood,
    agentTaskPassed: options.agentTaskPassed,
    notes: options.notes,
  },
  routing,
  assertions,
};

await writeJson(path.join(resultsDirectory, "build-repeat.json"), secondBuild);
await writeJson(path.join(resultsDirectory, "summary.json"), summary);
await writeFile(path.join(resultsDirectory, "summary.csv"), `${csvHeader()}\n${csvRow(summary)}\n`, "utf8");
await updateMatrix(matrixPath, summary);

if (!repeatedBuildStable) {
  throw new Error(`Repeated build output changed. Inspect ${path.join(resultsDirectory, "summary.json")}.`);
}
if (assertions.failed > 0) {
  throw new Error(`${assertions.failed} automated regression assertion(s) failed. Inspect ${path.join(resultsDirectory, "summary.json")}.`);
}
process.stdout.write(
  `Dogfood regression passed for ${summary.target}: ${summary.counts.pages} pages, ${summary.counts.taskPacks} task packs, readiness ${summary.readinessScore}, stable hash ${summary.repeatedBuild.secondHash}.\n`,
);

function parseOptions(args) {
  const parsed = {
    agentTaskPassed: "unknown",
    matrix: ".dogfood/regression-summary.csv",
    notes: "",
    queries: [],
    searchAuthGood: "unknown",
    searchQuickstartGood: "unknown",
    expectations: [],
    routingGoals: [],
    routeExpectations: new Map(),
  };
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (!value.startsWith("--") && parsed.target === undefined) {
      parsed.target = value;
      continue;
    }
    const key = value.slice(2);
    const next = args[index + 1];
    if (next === undefined) throw new Error(`Missing value for --${key}.`);
    index += 1;
    if (key === "agent-task-passed") parsed.agentTaskPassed = judgment(next);
    else if (key === "matrix") parsed.matrix = next;
    else if (key === "name") parsed.name = next;
    else if (key === "notes") parsed.notes = next;
    else if (key === "out") parsed.out = next;
    else if (key === "query") parsed.queries.push(parseQuery(next));
    else if (key === "results") parsed.results = next;
    else if (key === "routing-goal") parsed.routingGoals.push(parseQuery(next));
    else if (key === "expect-route") {
      const expectation = parseRouteExpectation(next);
      parsed.routeExpectations.set(expectation.label, expectation.expectedTaskPackIds);
    }
    else if (key === "search-auth-good") parsed.searchAuthGood = judgment(next);
    else if (key === "search-quickstart-good") parsed.searchQuickstartGood = judgment(next);
    else if (["expect-top", "expect-task-pack", "expect-no-mixed", "expect-warning"].includes(key)) {
      parsed.expectations.push({ kind: key, value: next });
    }
    else throw new Error(`Unknown option --${key}.`);
  }
  if (parsed.target === undefined) {
    throw new Error("Usage: pnpm regression:dogfood -- <target> [--out <path>] [--agent-task-passed true|false|unknown]");
  }
  for (const label of parsed.routeExpectations.keys()) {
    if (!parsed.routingGoals.some((goal) => goal.label === label)) {
      throw new Error(`--expect-route ${label}=... requires a matching --routing-goal ${label}=...`);
    }
  }
  return parsed;
}

async function evaluateRouting(options) {
  const results = [];
  for (const goal of options.routingGoals) {
    const expectedTaskPackIds = options.routeExpectations.get(goal.label);
    const handoff = JSON.parse(await run([...globals, "handoff", goal.query]));
    const verification = JSON.parse(await run([...globals, "verify-context", "--task", goal.query]));
    await writeJson(path.join(resultsDirectory, `routing-${goal.label}-handoff.json`), handoff);
    await writeJson(path.join(resultsDirectory, `routing-${goal.label}-verify.json`), verification);
    const selectedTaskPackId = handoff.selectedTaskPack?.id;
    const issueCodes = verification.issues?.map((issue) => issue.code) ?? [];
    const unsafe = issueCodes.some((code) => code === "mixed_context" || code === "mixed_search_context");
    const classification = unsafe
      ? "unsafe_mixed_context"
      : selectedTaskPackId === undefined
        ? "fallback"
        : expectedTaskPackIds?.includes(selectedTaskPackId) === true
          ? "matched_exact"
          : "matched_related";
    const passed = expectedTaskPackIds === undefined
      ? null
      : classification === "matched_exact";
    results.push({
      label: goal.label,
      goal: goal.query,
      selectedTaskPackId,
      selectedTaskPackTitle: handoff.selectedTaskPack?.title,
      verificationStatus: verification.status,
      warnings: handoff.warnings ?? [],
      issueCodes,
      classification,
      expectedTaskPackIds,
      passed,
      handoff,
      verification,
    });
  }
  const expected = results.filter((item) => item.expectedTaskPackIds !== undefined);
  const passed = expected.filter((item) => item.passed === true);
  const failed = expected.filter((item) => item.passed === false);
  const falsePositiveGate = expected.filter((item) => item.passed === true && item.verificationStatus !== "pass");
  const truePositiveGate = results.filter((item) => item.classification === "unsafe_mixed_context" && item.verificationStatus !== "pass");
  const falseNegativeGate = results.filter((item) => item.classification === "unsafe_mixed_context" && item.verificationStatus === "pass");
  return {
    total: results.length,
    expected: expected.length,
    passed: passed.length,
    failed: failed.length,
    fallback: results.filter((item) => item.classification === "fallback").length,
    matchedRelated: results.filter((item) => item.classification === "matched_related").length,
    unsafeMixedContext: results.filter((item) => item.classification === "unsafe_mixed_context").length,
    falsePositiveGate: falsePositiveGate.length,
    truePositiveGate: truePositiveGate.length,
    falseNegativeGate: falseNegativeGate.length,
    accuracy: expected.length === 0 ? null : roundRatio(passed.length / expected.length),
    falsePositiveGateRate: passed.length === 0 ? null : roundRatio(falsePositiveGate.length / passed.length),
    results: results.map(({ handoff, verification, ...item }) => item),
  };
}

function evaluateAssertions(options, searches, agentMap, routing) {
  const searchResults = options.expectations.map((expectation) => {
    if (expectation.kind === "expect-task-pack") {
      const passed = agentMap.taskPacks.some((pack) => pack.id === expectation.value);
      return { ...expectation, passed, message: passed ? "Task pack found." : "Task pack missing." };
    }
    const { label, query } = parseQuery(expectation.value);
    const response = searches[label];
    if (response === undefined) return { ...expectation, passed: false, message: `Search label "${label}" was not run.` };
    if (expectation.kind === "expect-top") {
      const passed = response.results[0]?.title === query;
      return { ...expectation, passed, message: `Top title: ${response.results[0]?.title ?? "none"}.` };
    }
    if (expectation.kind === "expect-warning") {
      const passed = response.warnings.some((warning) => warning.code === query);
      return { ...expectation, passed, message: `Warnings: ${response.warnings.map((warning) => warning.code).join(", ") || "none"}.` };
    }
    const values = new Set(response.results.flatMap((result) =>
      result.facets.filter((facet) => facet.key === query).map((facet) => facet.value)));
    const passed = response.results.length > 0 && values.size === 1;
    return { ...expectation, passed, message: `${query} values: ${[...values].join(", ") || "none"}.` };
  });
  const routeResults = routing.results
    .filter((item) => item.expectedTaskPackIds !== undefined)
    .map((item) => ({
      kind: "expect-route",
      value: `${item.label}=${item.expectedTaskPackIds.join(",")}`,
      passed: item.passed === true,
      message: item.selectedTaskPackId === undefined
        ? "No task pack selected."
        : `Selected task pack: ${item.selectedTaskPackId}; classification: ${item.classification}.`,
    }));
  const results = [...searchResults, ...routeResults];
  return {
    passed: results.filter((result) => result.passed).length,
    failed: results.filter((result) => !result.passed).length,
    results,
  };
}

function parseRouteExpectation(value) {
  const { label, query } = parseQuery(value);
  const expectedTaskPackIds = query.split(",").map((item) => item.trim()).filter((item) => item.length > 0);
  if (expectedTaskPackIds.length === 0) {
    throw new Error(`Expected at least one task-pack ID for --expect-route ${label}=...`);
  }
  for (const id of expectedTaskPackIds) {
    if (!/^[a-z0-9_-]+$/.test(id)) {
      throw new Error(`Expected task-pack ID "${id}" to contain only lowercase letters, numbers, hyphens, or underscores.`);
    }
  }
  return { label, expectedTaskPackIds };
}

function parseQuery(value) {
  const separator = value.indexOf("=");
  if (separator < 1 || separator === value.length - 1) {
    throw new Error(`Expected --query <label=query>; received "${value}".`);
  }
  const label = value.slice(0, separator);
  if (!/^[a-z0-9-]+$/.test(label)) {
    throw new Error(`Query label "${label}" must contain only lowercase letters, numbers, and hyphens.`);
  }
  return { label, query: value.slice(separator + 1) };
}

function judgment(value) {
  if (!["true", "false", "unknown"].includes(value)) {
    throw new Error(`Expected true, false, or unknown; received "${value}".`);
  }
  return value;
}

async function run(args) {
  const child = spawn(command, [...commandPrefix, ...args], {
    cwd: repositoryRoot,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const code = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  if (code !== 0) {
    await writeJson(path.join(resultsDirectory, "failure.json"), {
      args,
      code,
      stderr,
      stdout,
    });
    throw new Error(`AgentDocs command failed (${args.join(" ")}):\n${stdout}${stderr}`);
  }
  return stdout;
}

async function artifactHashes(directory) {
  const files = (await listFiles(directory)).filter(isGeneratedArtifact);
  return Object.fromEntries(await Promise.all(files.map(async (file) => [
    file,
    createHash("sha256").update(await readFile(path.join(directory, file))).digest("hex"),
  ])));
}

function isGeneratedArtifact(file) {
  return [
    "AGENTS.md",
    "agent-map.json",
    "documentation-map.json",
    "chunks.jsonl",
    "index.sqlite",
    "llms.txt",
    "manifest.json",
  ].includes(file)
    || file.startsWith("task-packs/");
}

async function listFiles(directory, relative = "") {
  const entries = await readdir(path.join(directory, relative), { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const child = path.posix.join(relative.replaceAll("\\", "/"), entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(directory, child));
    else files.push(child);
  }
  return files;
}

function aggregateHash(hashes) {
  return createHash("sha256").update(JSON.stringify(hashes)).digest("hex");
}

function roundRatio(value) {
  return Math.round(value * 10_000) / 10_000;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function updateMatrix(filePath, summary) {
  let rows = [];
  try {
    rows = normalizeCsvRows(await readFile(filePath, "utf8"));
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
  }
  const current = csvRow(summary);
  const prefix = `${csv(summary.target)},`;
  rows = [...rows.filter((row) => !row.startsWith(prefix)), current].sort();
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${csvHeader()}\n${rows.join("\n")}\n`, "utf8");
}

function csvHeader() {
  return "target,pages,task_packs,readiness,source_coverage_ratio,source_coverage_gap,routing_goals,routing_expected,routing_passed,routing_failed,routing_accuracy,routing_false_positive_gate_rate,build_cold_start_ms,build_incremental_ms,search_auth_good,search_quickstart_good,agent_task_passed,notes";
}

function csvRow(summary) {
  return [
    summary.target,
    summary.counts.pages,
    summary.counts.taskPacks,
    summary.readinessScore,
    summary.sourceCoverage.coverageRatio ?? "",
    summary.sourceCoverage.gapReason ?? summary.sourceCoverage.gapSeverity ?? "",
    summary.routing.total,
    summary.routing.expected,
    summary.routing.passed,
    summary.routing.failed,
    summary.routing.accuracy ?? "",
    summary.routing.falsePositiveGateRate ?? "",
    summary.performance?.buildColdStartMs ?? "",
    summary.performance?.buildIncrementalMs ?? "",
    summary.judgments.searchAuthGood,
    summary.judgments.searchQuickstartGood,
    summary.judgments.agentTaskPassed,
    summary.judgments.notes,
  ].map(csv).join(",");
}

function normalizeCsvRows(contents) {
  const lines = contents.trim().length === 0 ? [] : contents.trim().split(/\r?\n/);
  if (lines.length <= 1) return [];
  const sourceHeader = parseCsvLine(lines[0]);
  const targetHeader = csvHeader().split(",");
  return lines.slice(1).map((line) => {
    const sourceValues = parseCsvLine(line);
    const row = Object.fromEntries(sourceHeader.map((key, index) => [key, sourceValues[index] ?? ""]));
    return targetHeader.map((key) => csv(row[key] ?? "")).join(",");
  });
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"' && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

function csv(value) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
