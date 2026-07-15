import test from "node:test";
import assert from "node:assert/strict";
import { summarizeRuns } from "./aggregate-metrics.mjs";

test("operational failures are visible separately from completed task success", () => {
  const summary = summarizeRuns([
    run({ seed: 1, passed: true, outcome: "success" }),
    run({ seed: 2, passed: false, outcome: "task_failure" }),
    run({
      seed: 3,
      passed: false,
      outcome: "operational_failure",
      failure: { code: "provider_tpm_limit" },
    }),
  ]);

  assert.equal(summary.n, 3);
  assert.equal(summary.passed, 1);
  assert.equal(summary.serviceSuccessRate, 1 / 3);
  assert.equal(summary.completedN, 2);
  assert.equal(summary.taskSuccessRate, 1 / 2);
  assert.equal(summary.operationalFailureCount, 1);
  assert.deepEqual(summary.operationalFailureCodes, { provider_tpm_limit: 1 });
});

function run(overrides) {
  return {
    seed: 1,
    passed: false,
    outcome: "task_failure",
    tokens: { input: 0, output: 0, total: 0 },
    toolSchemaMetrics: {},
    hotTokenEstimates: {},
    toolCalls: {},
    retrievalPayloadByTool: {},
    contextDecisions: [],
    ...overrides,
  };
}
