# Make evaluation metrics explicit, downloadable, and stable across docs pages

## Problem

The public dogfood results are directionally useful, but the metric names and benchmark fields are not self-explanatory enough from the results page alone. The methodology page carries too much of the meaning, and hand-maintained tables can drift from the generated `summary.json` and `summary.csv` artifacts.

## Proposed change

Add a metrics reference page that defines every reported dogfood and benchmark field. Link each results table to downloadable `summary.json` and `summary.csv` artifacts where available. Prefer rendering public results tables from those artifacts instead of hand-maintained Markdown.

## Scope

- Define `pages`, `chunks`, `entities`, `task_packs`, `readiness`, `repeat_build_hash_match`, standard-query quality, workflow-query quality, and `agent_task_passed`.
- Expand `summary.csv` when needed so it includes the same stable public fields as `summary.json`.
- Add a worked example row that explains how to interpret a target result.
- Update docs links from results pages to the downloadable artifacts.
- Add a determinism check or fixture ensuring generated summary fields remain stable.

## Acceptance criteria

- A docs reader can understand every metric in the public results table without reading the runner source.
- `summary.json` and `summary.csv` are linked from relevant results pages.
- Public results tables are generated from or checked against the summary artifacts.
- Field names and definitions are versioned or documented as stable beta contracts.

## Notes

This reinforces the product principle that evaluation evidence should be inspectable and deterministic.
