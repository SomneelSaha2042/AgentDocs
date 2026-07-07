# Active Evaluation Sandbox

This document explains how to run active agent evaluations that compare
AgentDocs against clean control groups.

## Isolation Model

Each run creates three separate areas under a temporary sandbox:

- `workspace`: implementation files, tests, `package.json`, and `task.md`.
- `raw-docs-corpus`: the fixture's original `docs/` tree, hidden from normal
  file tools.
- `agentdocs-build`: a hidden full fixture copy used only by the experimental
  AgentDocs MCP server.

The agent's `read_file`, `write_file`, and `run_command` tools operate inside
`workspace`. Control groups cannot read `.agentdocs`, `agent-map.json`,
`chunks.jsonl`, task packs, generated `llms.txt`, or generated `AGENTS.md`.

## Groups

Use explicit `--group` values for new runs:

```bash
node scripts/eval-runner.mjs --task octokit-pagination --group experimental-agentdocs --seed 1
node scripts/eval-runner.mjs --task octokit-pagination --group control-local-raw --seed 1
node scripts/eval-runner.mjs --task octokit-pagination --group control-web-raw --seed 1
```

Group behavior:

- `experimental-agentdocs`: exposes AgentDocs MCP tools backed by hidden
  generated artifacts. By default the runner limits MCP to
  `search_docs,get_page`; pass `--mcp-tools` to benchmark a different surface.
- `control-local-raw`: exposes `search_raw_docs` and `read_raw_doc` over the
  hidden raw docs corpus.
- `control-web-raw`: exposes `web_search` and `fetch_webpage` over the same raw
  corpus, with web-fetch-like page noise.

Legacy flags still map to clean groups:

```bash
node scripts/eval-runner.mjs --task octokit-pagination --control
node scripts/eval-runner.mjs --task octokit-pagination --control --web
```

## Pilot Benchmark

For the first objective pass, run three seeds per task and group:

```bash
$tasks = @("dummy-sdk", "agentdocs-config", "aws-js-v3", "fastify-validation", "kubernetes-deployment", "nextjs-app-router", "octokit-pagination")
$groups = @("experimental-agentdocs", "control-local-raw", "control-web-raw")
$seeds = 1,2,3

foreach ($task in $tasks) {
  foreach ($group in $groups) {
    foreach ($seed in $seeds) {
      node scripts/eval-runner.mjs --task $task --group $group --seed $seed --max-cost 1.00
    }
  }
  node scripts/aggregate-metrics.mjs $task
}
```

Use `--model` to pin a model. Use `--max-cost` as a per-run circuit breaker.

## Dry Run

Dry runs exercise sandbox setup, raw corpus loading, contamination checks, and
result writing without installing dependencies or calling an LLM:

```bash
node scripts/eval-runner.mjs --task octokit-pagination --group control-local-raw --seed 101 --dry-run
```

Aggregates ignore dry-run result files.

## Telemetry Captured

Each result JSON records:

- task, group, model, provider, and seed;
- pass/fail, turns, duration, and token usage;
- tool schema token estimate, including base tool, raw-doc tool, and AgentDocs MCP tool categories;
- cold total tokens reported by the provider;
- analytical hot-session token estimates that subtract repeated AgentDocs MCP tool-schema overhead;
- retrieval payload token estimate;
- docs bytes returned by docs/MCP tools;
- tool call counts and per-turn breakdowns;
- final code hash, raw corpus hash, and AgentDocs build hash;
- contamination checks before and after the run.

The aggregator reports medians and success proportions by group. It reports both
cold provider token totals and hot-adjusted estimates. Hot-adjusted values are
analytical estimates, not billing truth: they subtract the repeated AgentDocs MCP
tool-schema token estimate from each run to model an already-loaded AgentDocs
session. Treat single-run results as smoke checks only; use the seeded pilot for
claims.
