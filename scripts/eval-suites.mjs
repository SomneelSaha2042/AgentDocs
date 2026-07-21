export const CLEAN_EVAL_GROUPS = [
  "experimental-agentdocs",
  "control-local-raw",
  "control-web-raw",
];

export const NORTH_STAR_SUITE = Object.freeze({
  id: "north-star-v1",
  tasks: Object.freeze(["authjs-v5", "stripe-webhooks-holdout", "langchain-js"]),
  groups: Object.freeze([...CLEAN_EVAL_GROUPS]),
  seeds: Object.freeze([1, 2, 3]),
  model: "gpt-4o",
  provider: "openai",
  maxCost: 1,
  maxInputTokens: 24000,
  maxOutputTokens: 2000,
  mcpTools: "query_docs,read_page",
});

export const EVAL_SUITES = Object.freeze({
  [NORTH_STAR_SUITE.id]: NORTH_STAR_SUITE,
});

export function parseSeedList(value) {
  const values = String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => Number(item));
  if (values.length === 0 || values.some((seed) => !Number.isInteger(seed) || seed <= 0)) {
    throw new Error("seeds must be a comma-separated list of positive integer values");
  }
  return [...new Set(values)].sort((left, right) => left - right);
}

export function suiteById(id) {
  const suite = EVAL_SUITES[id];
  if (!suite) {
    throw new Error(`Unknown evaluation suite: ${id}`);
  }
  return suite;
}

export function resultDirectoryFor(suiteId, runId) {
  const safeSuiteId = String(suiteId).replace(/[^a-z0-9._-]/gi, "-");
  const safeRunId = String(runId).replace(/[^a-z0-9._-]/gi, "-");
  if (!safeSuiteId || !safeRunId) {
    throw new Error("suite id and run id are required");
  }
  return `.dogfood/evals/${safeRunId}-${safeSuiteId}`;
}

export function plannedRuns(suite, { seeds = suite.seeds, groups = suite.groups } = {}) {
  return suite.tasks.flatMap((task) => groups.flatMap((group) => seeds.map((seed) => ({
    task,
    group,
    seed,
  }))));
}
