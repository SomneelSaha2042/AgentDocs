# Routing Benchmarks Phase 3

Date: June 20, 2026.

## What Changed

- Added dogfood routing goals with `--routing-goal <label=goal>`.
- Added explicit route expectations with `--expect-route <label=task-id[,task-id]>`.
- Recorded routing results in `summary.json` and compact routing columns in
  `summary.csv`.
- Preserved report-only routing by default. Runs fail only when an explicit
  route expectation misses.
- Added an offline fixture assertion that verifies the quickstart goal routes
  to the quickstart task pack.

## Why This Matters

Readiness and search quality show whether generated context exists and looks
useful. Routing benchmarks check a more agent-specific question: when a user
asks for a concrete goal, does AgentDocs select the expected task pack or fall
back to generic source evidence?

## Routing Classifications

| Classification | Meaning |
| --- | --- |
| `matched_exact` | Selected task pack matches the expected task-pack ID list. |
| `matched_related` | A task pack was selected, but no expectation was declared or it was not expected. |
| `fallback` | No task pack was selected; AgentDocs used source search and goal-bundle evidence. |
| `unsafe_mixed_context` | Verification reported mixed task or search context. |

## Commands To Run

```bash
corepack pnpm build
corepack pnpm regression:fixtures
corepack pnpm docs:build
corepack pnpm typecheck
corepack pnpm test
```

## Known Limitations

- Routing accuracy is a beta metric and should be read alongside source
  coverage, readiness, search captures, and `agent_task_passed`.
- Historical dogfood rows may not have routing metrics. Treat those as
  `historical_metric_not_captured`, not zero.
- This phase adds measurement. It does not add new task-pack families or an LLM
  router.
