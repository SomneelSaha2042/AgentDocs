import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const CLEAN_GROUPS = ["experimental-agentdocs", "experimental-agentdocs-local-coldstart", "control-local-raw", "control-web-raw"];
const LEGACY_GROUPS = {
  experimental: "experimental-agentdocs",
  control: "control-local-raw",
  "control-web": "control-web-raw",
};

async function main() {
  const args = process.argv.slice(2);
  const taskNames = positionalArgs(args);
  const resultsDir = path.resolve(repositoryRoot, getArg(args, "--results-dir") || ".dogfood");
  if (taskNames.length === 0) taskNames.push("dummy-sdk");

  const summaries = [];
  for (const taskName of taskNames) {
    summaries.push(await aggregateTask(taskName, resultsDir));
  }
  if (summaries.length > 1) {
    const suiteSummary = aggregateSuite(summaries, resultsDir);
    const suitePath = path.join(resultsDir, "suite-summary.json");
    await writeFile(suitePath, `${JSON.stringify(suiteSummary, null, 2)}\n`, "utf8");
    printSuiteSummary(suiteSummary, suitePath);
  }
}

async function aggregateTask(taskName, resultsDir) {

  console.log(`Aggregating metrics for task: ${taskName}`);

  const runs = await loadRuns(resultsDir, taskName);
  if (runs.length === 0) {
    console.error(`No eval results found for task: ${taskName}`);
    process.exit(1);
  }

  const grouped = groupBy(runs, (run) => run.group);
  const groupSummaries = Object.fromEntries(
    Object.entries(grouped).map(([group, groupRuns]) => [group, summarizeRuns(groupRuns)]),
  );
  const experimentalGroup = groupSummaries["experimental-agentdocs-local-coldstart"] !== undefined
    ? "experimental-agentdocs-local-coldstart"
    : "experimental-agentdocs";
  const experimental = groupSummaries[experimentalGroup];
  if (experimental === undefined) {
    console.error("Missing experimental results (experimental-agentdocs or experimental-agentdocs-local-coldstart).");
    process.exit(1);
  }

  const comparisons = {};
  for (const controlGroup of ["control-local-raw", "control-web-raw"]) {
    const control = groupSummaries[controlGroup];
    if (control !== undefined) {
      comparisons[`vs_${controlGroup}`] = compareSummaries(experimental, control);
    }
  }

  const summary = {
    schemaVersion: 3,
    task: taskName,
    generatedAt: new Date().toISOString(),
    groups: groupSummaries,
    comparisons,
    runs,
  };

  const summaryPath = path.join(resultsDir, `eval-summary-${taskName}.json`);
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  printSummary(taskName, groupSummaries, comparisons, summaryPath);
  return summary;
}

function aggregateSuite(summaries, resultsDir) {
  const groups = {};
  for (const group of CLEAN_GROUPS) {
    const taskSummaries = summaries.map((summary) => summary.groups[group]).filter(Boolean);
    if (taskSummaries.length === 0) continue;
    const passed = taskSummaries.reduce((sum, summary) => sum + summary.passed, 0);
    const n = taskSummaries.reduce((sum, summary) => sum + summary.n, 0);
    groups[group] = { n, passed, failed: n - passed, successRate: n > 0 ? passed / n : null };
  }
  const experimental = groups["experimental-agentdocs"];
  const controls = ["control-local-raw", "control-web-raw"]
    .map((group) => ({ group, summary: groups[group] }))
    .filter((item) => item.summary);
  const taskRegressions = [];
  for (const summary of summaries) {
    const agent = summary.groups["experimental-agentdocs"];
    for (const { group, summary: control } of controls) {
      const controlTask = summary.groups[group];
      if (agent && controlTask && agent.passed < controlTask.passed) {
        taskRegressions.push({ task: summary.task, control: group, agentPassed: agent.passed, controlPassed: controlTask.passed });
      }
    }
  }
  const aggregateTie = Boolean(
    experimental
      && controls.length === 2
      && controls.every(({ summary }) => experimental.passed >= summary.passed),
  );
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    resultsDir,
    tasks: summaries.map((summary) => summary.task),
    groups,
    decision: {
      gate: "no_success_regression",
      aggregateTieOrBetter: Boolean(aggregateTie),
      taskRegressions,
      passed: aggregateTie && taskRegressions.length === 0,
    },
    taskSummaries: summaries.map((summary) => ({
      task: summary.task,
      groups: summary.groups,
      comparisons: summary.comparisons,
    })),
  };
}

function printSuiteSummary(summary, suitePath) {
  console.log("\nNorth-star suite summary:");
  console.log(`  Gate: ${summary.decision.passed ? "PASS" : "DO NOT ADVANCE"}`);
  for (const [group, values] of Object.entries(summary.groups)) {
    console.log(`  ${group}: ${values.passed}/${values.n} (${Math.round(values.successRate * 100)}%)`);
  }
  if (summary.decision.taskRegressions.length > 0) {
    console.log(`  Task regressions: ${summary.decision.taskRegressions.length}`);
  }
  console.log(`Saved suite summary to ${suitePath}`);
}

async function loadRuns(resultsDir, taskName) {
  const entries = await readdir(resultsDir).catch(() => []);
  const cleanPattern = new RegExp(`^eval-result-${escapeRegex(taskName)}-(${CLEAN_GROUPS.map(escapeRegex).join("|")})-seed-(\\d+)\\.json$`);
  const cleanFiles = entries.filter((entry) => cleanPattern.test(entry));
  if (cleanFiles.length > 0) {
    const cleanRuns = await Promise.all(cleanFiles.map(async (file) => normalizeRun(JSON.parse(
      await readFile(path.join(resultsDir, file), "utf8"),
    ))));
    const nonDryRuns = cleanRuns.filter((run) => !isDryRun(run));
    if (nonDryRuns.length > 0) {
      return nonDryRuns;
    }
  }

  const legacyRuns = [];
  for (const [legacy, group] of Object.entries(LEGACY_GROUPS)) {
    const file = path.join(resultsDir, `eval-result-${taskName}-${legacy}.json`);
    try {
      legacyRuns.push(normalizeRun({
        ...JSON.parse(await readFile(file, "utf8")),
        group,
        seed: 1,
        schemaVersion: 1,
      }));
    } catch {
      // Missing legacy groups are allowed.
    }
  }
  return legacyRuns;
}

function isDryRun(run) {
  return run.dryRun === true
    || (run.schemaVersion >= 2
      && run.turns === 0
      && run.tokens.total === 0
      && /Dry run completed/.test(run.testOutput ?? ""));
}

function normalizeRun(run) {
  const group = run.group
    ?? (run.control ? (run.web ? "control-web-raw" : "control-local-raw") : "experimental-agentdocs");
  return {
    ...run,
    group,
    seed: run.seed ?? 1,
    tokens: {
      input: run.tokens?.input ?? 0,
      output: run.tokens?.output ?? 0,
      total: run.tokens?.total ?? ((run.tokens?.input ?? 0) + (run.tokens?.output ?? 0)),
    },
    toolSchemaTokenEstimate: run.toolSchemaTokenEstimate,
    toolSchemaMetrics: normalizeToolSchemaMetrics(run),
    hotTokenEstimates: normalizeHotTokenEstimates(run),
    retrievalPayloadTokenEstimate: run.retrievalPayloadTokenEstimate,
    docsBytesReturned: run.docsBytesReturned,
    retrievalPayloadByTool: run.retrievalPayloadByTool ?? {},
    contextDecisions: run.contextDecisions ?? [],
    verification: run.verification,
  };
}

function normalizeToolSchemaMetrics(run) {
  const total = run.toolSchemaMetrics?.totalToolSchemaTokenEstimate ?? run.toolSchemaTokenEstimate;
  return {
    baseToolSchemaTokenEstimate: run.toolSchemaMetrics?.baseToolSchemaTokenEstimate,
    rawDocsToolSchemaTokenEstimate: run.toolSchemaMetrics?.rawDocsToolSchemaTokenEstimate,
    docsToolSchemaTokenEstimate: run.toolSchemaMetrics?.docsToolSchemaTokenEstimate,
    totalToolSchemaTokenEstimate: total,
    toolSchemaByTool: run.toolSchemaMetrics?.toolSchemaByTool ?? {},
  };
}

function normalizeHotTokenEstimates(run) {
  const total = run.tokens?.total ?? 0;
  return {
    coldTotalTokens: run.hotTokenEstimates?.coldTotalTokens ?? total,
    docsSchemaRepeatedTaxEstimate: run.hotTokenEstimates?.docsSchemaRepeatedTaxEstimate,
    hotAdjustedInputTokensEstimate: run.hotTokenEstimates?.hotAdjustedInputTokensEstimate,
    hotAdjustedTotalTokensEstimate: run.hotTokenEstimates?.hotAdjustedTotalTokensEstimate ?? total,
  };
}
function summarizeRuns(runs) {
  const sorted = [...runs].sort((left, right) => (left.seed ?? 0) - (right.seed ?? 0));
  const passCount = sorted.filter((run) => run.passed).length;
  return {
    n: sorted.length,
    seeds: sorted.map((run) => run.seed),
    successRate: passCount / sorted.length,
    passed: passCount,
    failed: sorted.length - passCount,
    medians: {
      turns: median(sorted.map((run) => run.turns)),
      durationMs: median(sorted.map((run) => run.durationMs)),
      inputTokens: median(sorted.map((run) => run.tokens.input)),
      outputTokens: median(sorted.map((run) => run.tokens.output)),
      totalTokens: median(sorted.map((run) => run.tokens.total)),
      toolSchemaTokenEstimate: medianPresent(sorted.map((run) => run.toolSchemaTokenEstimate)),
      docsToolSchemaTokenEstimate: medianPresent(sorted.map((run) => run.toolSchemaMetrics.docsToolSchemaTokenEstimate)),
      rawDocsToolSchemaTokenEstimate: medianPresent(sorted.map((run) => run.toolSchemaMetrics.rawDocsToolSchemaTokenEstimate)),
      docsSchemaRepeatedTaxEstimate: medianPresent(sorted.map((run) => run.hotTokenEstimates.docsSchemaRepeatedTaxEstimate)),
      hotAdjustedInputTokensEstimate: medianPresent(sorted.map((run) => run.hotTokenEstimates.hotAdjustedInputTokensEstimate)),
      hotAdjustedTotalTokensEstimate: medianPresent(sorted.map((run) => run.hotTokenEstimates.hotAdjustedTotalTokensEstimate)),
      retrievalPayloadTokenEstimate: medianPresent(sorted.map((run) => run.retrievalPayloadTokenEstimate)),
      docsBytesReturned: medianPresent(sorted.map((run) => run.docsBytesReturned)),
    },
    minMax: {
      totalTokens: minMax(sorted.map((run) => run.tokens.total)),
      turns: minMax(sorted.map((run) => run.turns)),
      durationMs: minMax(sorted.map((run) => run.durationMs)),
    },
    contaminationPassed: sorted.every((run) => run.contaminationChecks?.passed !== false),
    completion: summarizeCompletion(sorted),
    contextDecisions: summarizeContextDecisions(sorted),
    verification: summarizeVerification(sorted),
    toolCalls: mergeToolCalls(sorted),
    retrievalPayloadByTool: mergeRetrievalPayloadByTool(sorted),
    toolSchemaByTool: mergeToolSchemaByTool(sorted),
  };
}

function summarizeContextDecisions(runs) {
  const decisions = runs.flatMap((run) => run.contextDecisions ?? []);
  const byRecommendation = {};
  for (const decision of decisions) {
    const recommendation = decision.readiness?.recommendation ?? "unknown";
    byRecommendation[recommendation] = (byRecommendation[recommendation] ?? 0) + 1;
  }
  return {
    observedQueries: decisions.length,
    parseFailures: decisions.filter((decision) => decision.parseStatus !== "ok").length,
    byRecommendation: Object.fromEntries(Object.entries(byRecommendation).sort(([left], [right]) => left.localeCompare(right))),
  };
}

function summarizeVerification(runs) {
  const values = runs.map((run) => run.verification).filter(Boolean);
  if (values.length === 0) return { observedRuns: 0 };
  const rate = (key) => values.filter((value) => value[key] === true).length / values.length;
  return {
    observedRuns: values.length,
    publicSmokePassRate: rate("publicSmokePassed"),
    privateOraclePresentRate: rate("privateOraclePresent"),
    privateOraclePassRate: rate("privateOraclePassed"),
  };
}

function summarizeCompletion(runs) {
  const completion = runs.map((run) => run.completion).filter((value) => value !== undefined);
  const count = completion.length;
  const rate = (predicate) => count === 0 ? null : completion.filter(predicate).length / count;
  const finishReasons = {};
  for (const item of completion) {
    const reason = item.finishReason ?? "unknown";
    finishReasons[reason] = (finishReasons[reason] ?? 0) + 1;
  }
  return {
    observedRuns: count,
    writeAttemptRate: rate((item) => item.wroteFiles === true),
    testCommandRate: rate((item) => item.ranTestCommand === true),
    complianceRecoveryRate: rate((item) => item.complianceRecoveryUsed === true),
    finishReasons: Object.fromEntries(Object.entries(finishReasons).sort(([left], [right]) => left.localeCompare(right))),
  };
}

function compareSummaries(experimental, control) {
  const tokenDelta = control.medians.totalTokens - experimental.medians.totalTokens;
  const hotTokenDelta = (control.medians.hotAdjustedTotalTokensEstimate ?? control.medians.totalTokens)
    - (experimental.medians.hotAdjustedTotalTokensEstimate ?? experimental.medians.totalTokens);
  const hotControlTokens = control.medians.hotAdjustedTotalTokensEstimate ?? control.medians.totalTokens;
  const turnDelta = control.medians.turns - experimental.medians.turns;
  const durationDelta = control.medians.durationMs - experimental.medians.durationMs;
  return {
    successRateDelta: experimental.successRate - control.successRate,
    medianTurnsSaved: turnDelta,
    medianDurationMsSaved: durationDelta,
    medianTokenUsageDelta: {
      raw: tokenDelta,
      percentSaved: control.medians.totalTokens > 0
        ? Math.round((tokenDelta / control.medians.totalTokens) * 100)
        : 0,
    },
    medianHotAdjustedTokenUsageDelta: {
      raw: hotTokenDelta,
      percentSaved: hotControlTokens > 0
        ? Math.round((hotTokenDelta / hotControlTokens) * 100)
        : 0,
    },
    experimentalN: experimental.n,
    controlN: control.n,
  };
}

function printSummary(taskName, groups, comparisons, summaryPath) {
  console.log(`\nAggregate Summary for ${taskName}:`);
  console.log("-----------------------------------");
  for (const group of CLEAN_GROUPS) {
    const summary = groups[group];
    if (summary === undefined) continue;
    console.log(`${group}:`);
    console.log(`  N: ${summary.n}, Success: ${summary.passed}/${summary.n} (${Math.round(summary.successRate * 100)}%)`);
    console.log(`  Median Turns: ${summary.medians.turns}`);
    console.log(`  Median Tokens: ${summary.medians.totalTokens}`);
    console.log(`  Median Hot-Adjusted Tokens: ${summary.medians.hotAdjustedTotalTokensEstimate ?? "n/a"}`);
    console.log(`  Median Docs Schema Tax Estimate: ${summary.medians.docsSchemaRepeatedTaxEstimate ?? "n/a"}`);
    console.log(`  Median Retrieval Payload Tokens: ${summary.medians.retrievalPayloadTokenEstimate ?? "n/a"}`);
    console.log(`  Contamination Checks: ${summary.contaminationPassed ? "pass" : "fail"}`);
  }
  for (const [name, comparison] of Object.entries(comparisons)) {
    console.log(`${name}:`);
    console.log(`  Success Rate Delta: ${formatSigned(Math.round(comparison.successRateDelta * 100))}%`);
    console.log(`  Median Turns Saved: ${comparison.medianTurnsSaved}`);
    console.log(`  Median Tokens Saved: ${comparison.medianTokenUsageDelta.raw} (${comparison.medianTokenUsageDelta.percentSaved}%)`);
    console.log(`  Median Hot-Adjusted Tokens Saved: ${comparison.medianHotAdjustedTokenUsageDelta.raw} (${comparison.medianHotAdjustedTokenUsageDelta.percentSaved}%)`);
    console.log(`  Median Time Delta: ${comparison.medianDurationMsSaved >= 0 ? "Saved" : "Added"} ${Math.abs(comparison.medianDurationMsSaved)}ms`);
  }
  console.log(`Saved detailed summary to ${summaryPath}`);
}

function mergeToolCalls(runs) {
  const merged = {};
  for (const run of runs) {
    for (const [tool, count] of Object.entries(run.toolCalls ?? {})) {
      merged[tool] = (merged[tool] ?? 0) + count;
    }
  }
  return Object.fromEntries(Object.entries(merged).sort(([left], [right]) => left.localeCompare(right)));
}

function mergeToolSchemaByTool(runs) {
  const merged = {};
  for (const run of runs) {
    for (const [tool, tokens] of Object.entries(run.toolSchemaMetrics.toolSchemaByTool ?? {})) {
      merged[tool] = (merged[tool] ?? 0) + tokens;
    }
  }
  return Object.fromEntries(Object.entries(merged).sort(([left], [right]) => left.localeCompare(right)));
}
function mergeRetrievalPayloadByTool(runs) {
  const merged = {};
  for (const run of runs) {
    for (const [tool, payload] of Object.entries(run.retrievalPayloadByTool ?? {})) {
      merged[tool] ??= { calls: 0, docsBytesReturned: 0, retrievalPayloadTokenEstimate: 0 };
      merged[tool].calls += payload.calls ?? 0;
      merged[tool].docsBytesReturned += payload.docsBytesReturned ?? 0;
      merged[tool].retrievalPayloadTokenEstimate += payload.retrievalPayloadTokenEstimate ?? 0;
    }
  }
  return Object.fromEntries(Object.entries(merged).sort(([left], [right]) => left.localeCompare(right)));
}

function groupBy(values, keyFor) {
  return values.reduce((groups, value) => {
    const key = keyFor(value);
    groups[key] ??= [];
    groups[key].push(value);
    return groups;
  }, {});
}

function median(values) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((left, right) => left - right);
  if (sorted.length === 0) return 0;
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[midpoint - 1] + sorted[midpoint]) / 2)
    : sorted[midpoint];
}

function medianPresent(values) {
  const present = values.filter((value) => Number.isFinite(value));
  return present.length === 0 ? undefined : median(present);
}

function minMax(values) {
  const present = values.filter((value) => Number.isFinite(value));
  return present.length === 0
    ? { min: 0, max: 0 }
    : { min: Math.min(...present), max: Math.max(...present) };
}

function formatSigned(value) {
  return value > 0 ? `+${value}` : `${value}`;
}

function getArg(args, key) {
  const index = args.indexOf(key);
  return index >= 0 ? args[index + 1] : null;
}

function positionalArgs(args) {
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--results-dir") {
      index += 1;
      continue;
    }
    if (!args[index].startsWith("--")) values.push(args[index]);
  }
  return values;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
