import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dirname, "..");

async function main() {
  const args = process.argv.slice(2);
  const taskName = args[0] || "dummy-sdk";

  console.log(`Aggregating metrics for task: ${taskName}`);

  const resultsDir = path.join(repositoryRoot, ".dogfood");
  const controlPath = path.join(resultsDir, `eval-result-${taskName}-control.json`);
  const experimentalPath = path.join(resultsDir, `eval-result-${taskName}-experimental.json`);

  let control, experimental;
  try {
    control = JSON.parse(await readFile(controlPath, "utf8"));
  } catch (err) {
    console.error(`Missing control results file: ${controlPath}`);
    process.exit(1);
  }

  try {
    experimental = JSON.parse(await readFile(experimentalPath, "utf8"));
  } catch (err) {
    console.error(`Missing experimental results file: ${experimentalPath}`);
    process.exit(1);
  }

  const successRateDelta = (experimental.passed ? 1 : 0) - (control.passed ? 1 : 0);
  
  // Tokens delta (negative means experimental used more, positive means experimental saved tokens)
  const tokenUsageDelta = control.tokens.total - experimental.tokens.total;
  const tokenUsagePercentSaved = control.tokens.total > 0 
    ? Math.round((tokenUsageDelta / control.tokens.total) * 100) 
    : 0;

  // Turns delta
  const turnDelta = control.turns - experimental.turns;

  // Duration delta
  const durationDeltaMs = control.durationMs - experimental.durationMs;

  const summary = {
    task: taskName,
    metrics: {
      taskSuccessRateDelta: successRateDelta, // 1 (improved), 0 (no change), -1 (worse)
      timeToCorrectImplementationDeltaMs: durationDeltaMs,
      turnsSaved: turnDelta,
      tokenUsageDelta: {
        raw: tokenUsageDelta,
        percentSaved: tokenUsagePercentSaved
      }
    },
    runs: {
      control,
      experimental
    }
  };

  const summaryPath = path.join(resultsDir, `eval-summary-${taskName}.json`);
  await writeFile(summaryPath, JSON.stringify(summary, null, 2), "utf8");

  console.log(`\nAggregate Summary for ${taskName}:`);
  console.log(`-----------------------------------`);
  console.log(`Task Success Rate Delta: ${successRateDelta > 0 ? "+" : ""}${successRateDelta * 100}%`);
  console.log(`Turns Saved: ${turnDelta}`);
  console.log(`Tokens Saved: ${tokenUsageDelta} (${tokenUsagePercentSaved}%)`);
  console.log(`Time Delta: ${durationDeltaMs > 0 ? "Saved " : "Added "}${Math.abs(durationDeltaMs)}ms`);
  console.log(`Saved detailed summary to ${summaryPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
