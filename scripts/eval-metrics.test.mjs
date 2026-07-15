import test from "node:test";
import assert from "node:assert/strict";
import { aggregateSuite, summarizeRuns } from "./aggregate-metrics.mjs";

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

test("dual gate makes incomplete control comparisons inconclusive", () => {
  const summaries = [
    taskSummary("auth", {
      experimental: [run({ seed: 1, passed: true, outcome: "success" }), run({ seed: 2, passed: false, outcome: "task_failure" })],
      control: [run({ seed: 1, passed: true, outcome: "success" })],
    }),
  ];
  const result = aggregateSuite(summaries, ".dogfood/test", {
    validations: [{ task: "auth", valid: true }],
    plannedRuns: [
      ...[1, 2, 3].map((seed) => ({ task: "auth", group: "experimental-agentdocs", seed })),
      ...[1, 2, 3].map((seed) => ({ task: "auth", group: "control-local-raw", seed })),
      ...[1, 2, 3].map((seed) => ({ task: "auth", group: "control-web-raw", seed })),
    ],
  });
  assert.equal(result.decision.status, "do_not_advance");
  assert.equal(result.decision.experimentalIncompleteTasks.length, 1);
  assert.equal(result.decision.inconclusiveTasks.length, 2);
});

test("dual gate passes a complete tie", () => {
  const summaries = [
    taskSummary("auth", {
      experimental: [run({ seed: 1, passed: true, outcome: "success" }), run({ seed: 2, passed: false, outcome: "task_failure" }), run({ seed: 3, passed: false, outcome: "task_failure" })],
      control: [run({ seed: 1, passed: true, outcome: "success" }), run({ seed: 2, passed: false, outcome: "task_failure" }), run({ seed: 3, passed: false, outcome: "task_failure" })],
    }),
  ];
  const result = aggregateSuite(summaries, ".dogfood/test", {
    validations: [{ task: "auth", valid: true }],
    plannedRuns: [
      ...[1, 2, 3].map((seed) => ({ task: "auth", group: "experimental-agentdocs", seed })),
      ...[1, 2, 3].map((seed) => ({ task: "auth", group: "control-local-raw", seed })),
      ...[1, 2, 3].map((seed) => ({ task: "auth", group: "control-web-raw", seed })),
    ],
  });
  assert.equal(result.decision.status, "pass");
  assert.equal(result.decision.passed, true);
});

function taskSummary(task, groups) {
  return {
    task,
    groups: {
      "experimental-agentdocs": summarizeRuns(groups.experimental),
      "control-local-raw": summarizeRuns(groups.control),
      "control-web-raw": summarizeRuns(groups.control),
    },
  };
}

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
