import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dirname, "..");

async function main() {
  const args = process.argv.slice(2);
  const taskName = args[0] || "dummy-sdk";

  console.log(`Aggregating metrics for task: ${taskName}`);

  const resultsDir = path.join(repositoryRoot, ".dogfood");
  const controlPath = path.join(resultsDir, `eval-result-${taskName}-control.json`);
  const controlWebPath = path.join(resultsDir, `eval-result-${taskName}-control-web.json`);
  const experimentalPath = path.join(resultsDir, `eval-result-${taskName}-experimental.json`);

  let control = null, controlWeb = null, experimental = null;
  try {
    control = JSON.parse(await readFile(controlPath, "utf8"));
  } catch (err) {
    console.warn(`Note: Missing standard control results file: ${controlPath}`);
  }

  try {
    controlWeb = JSON.parse(await readFile(controlWebPath, "utf8"));
  } catch (err) {
    // Optional
  }

  try {
    experimental = JSON.parse(await readFile(experimentalPath, "utf8"));
  } catch (err) {
    console.error(`Missing experimental results file: ${experimentalPath}`);
    process.exit(1);
  }

  if (!control && !controlWeb) {
    console.error("Must have at least one control results file (either standard or web control).");
    process.exit(1);
  }

  const summary = {
    task: taskName,
    metrics: {},
    runs: {
      experimental
    }
  };

  if (control) {
    const successRateDelta = (experimental.passed ? 1 : 0) - (control.passed ? 1 : 0);
    const tokenUsageDelta = control.tokens.total - experimental.tokens.total;
    const tokenUsagePercentSaved = control.tokens.total > 0 
      ? Math.round((tokenUsageDelta / control.tokens.total) * 100) 
      : 0;
    const turnDelta = control.turns - experimental.turns;
    const durationDeltaMs = control.durationMs - experimental.durationMs;

    summary.metrics = {
      taskSuccessRateDelta: successRateDelta,
      timeToCorrectImplementationDeltaMs: durationDeltaMs,
      turnsSaved: turnDelta,
      tokenUsageDelta: {
        raw: tokenUsageDelta,
        percentSaved: tokenUsagePercentSaved
      }
    };
    summary.runs.control = control;
  }

  if (controlWeb) {
    const successRateDeltaWeb = (experimental.passed ? 1 : 0) - (controlWeb.passed ? 1 : 0);
    const tokenUsageDeltaWeb = controlWeb.tokens.total - experimental.tokens.total;
    const tokenUsagePercentSavedWeb = controlWeb.tokens.total > 0 
      ? Math.round((tokenUsageDeltaWeb / controlWeb.tokens.total) * 100) 
      : 0;
    const turnDeltaWeb = controlWeb.turns - experimental.turns;
    const durationDeltaMsWeb = controlWeb.durationMs - experimental.durationMs;

    summary.metricsWeb = {
      taskSuccessRateDelta: successRateDeltaWeb,
      timeToCorrectImplementationDeltaMs: durationDeltaMsWeb,
      turnsSaved: turnDeltaWeb,
      tokenUsageDelta: {
        raw: tokenUsageDeltaWeb,
        percentSaved: tokenUsagePercentSavedWeb
      }
    };
    summary.runs.controlWeb = controlWeb;
  }

  const summaryPath = path.join(resultsDir, `eval-summary-${taskName}.json`);
  await writeFile(summaryPath, JSON.stringify(summary, null, 2), "utf8");

  console.log(`\nAggregate Summary for ${taskName}:`);
  console.log(`-----------------------------------`);
  if (control) {
    const m = summary.metrics;
    console.log(`Vs Standard Control (Grep):`);
    console.log(`  Success Rate Delta: ${m.taskSuccessRateDelta > 0 ? "+" : ""}${m.taskSuccessRateDelta * 100}%`);
    console.log(`  Turns Saved: ${m.turnsSaved}`);
    console.log(`  Tokens Saved: ${m.tokenUsageDelta.raw} (${m.tokenUsageDelta.percentSaved}%)`);
    console.log(`  Time Delta: ${m.timeToCorrectImplementationDeltaMs > 0 ? "Saved " : "Added "}${Math.abs(m.timeToCorrectImplementationDeltaMs)}ms`);
  }
  if (controlWeb) {
    const mw = summary.metricsWeb;
    console.log(`Vs Web Control (Search/Fetch Webpage):`);
    console.log(`  Success Rate Delta: ${mw.taskSuccessRateDelta > 0 ? "+" : ""}${mw.taskSuccessRateDelta * 100}%`);
    console.log(`  Turns Saved: ${mw.turnsSaved}`);
    console.log(`  Tokens Saved: ${mw.tokenUsageDelta.raw} (${mw.tokenUsageDelta.percentSaved}%)`);
    console.log(`  Time Delta: ${mw.timeToCorrectImplementationDeltaMs > 0 ? "Saved " : "Added "}${Math.abs(mw.timeToCorrectImplementationDeltaMs)}ms`);
  }
  console.log(`Saved detailed summary to ${summaryPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
