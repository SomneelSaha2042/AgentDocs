# Evaluation Metrics Reference

This page defines the beta reporting fields used by AgentDocs dogfood and
benchmark runs. The fields are stable enough for public interpretation during
the beta, but historical rows may omit newer fields. Missing historical values
should be labeled, not treated as zero.

Active evaluator result files use schema version 4. Older result files remain
readable through normalization but may not contain outcome or budget fields.

## Summary Artifacts

Each `pnpm regression:dogfood` run writes local machine-readable evidence:

```txt
results/
  summary.json
  summary.csv
```

`summary.json` is the complete evidence record. `summary.csv` is the compact
single-row form used for cross-target tables such as
`.dogfood/regression-summary.csv`.

## Core Fields

| Field | Meaning |
| --- | --- |
| `target` | Stable label for the prepared docs target. |
| `pages` | Normalized source pages accepted into the AgentDocs model. For crawls, this is bounded by scope and page budget. |
| `chunks` | Heading-aware text units generated from pages and written to `chunks.jsonl`. |
| `entities` | Deterministic graph entities such as packages, imports, environment variables, CLI commands, routes, versions, warnings, and concepts. |
| `task_packs` | Evidence-linked task bundles generated for families such as quickstart, authentication, migration, errors, deployment, and configuration. |
| `readiness` | `agentdocs doctor` score out of 100. This is an audit score, not proof that an agent can complete a task. |
| `repeat_build_hash_match` | Whether two consecutive builds produced the same generated-artifact hash. |
| `broken_links` | Known broken internal links among collected pages. Uncollected out-of-scope links are tracked separately by doctor. |
| `warnings` | Doctor warnings that require review but do not necessarily fail a run. |
| `deprecations` | Deprecated concepts found through deterministic extraction. |

## Coverage Fields

| Field | Meaning |
| --- | --- |
| `source_coverage_ratio` | `compiledFiles / intendedFiles` for the configured source scope. |
| `source_coverage_gap` | Reason or severity for incomplete source coverage. |
| `supportedFiles` | Markdown/MDX files in scope that AgentDocs can ingest today. |
| `unsupportedFiles` | Docs-like files in scope that AgentDocs currently counts but does not parse, such as reST or AsciiDoc. |
| `compiledFiles` | Supported files that produced usable or degraded normalized pages. |

Use source coverage to avoid false confidence. A one-page Markdown result from
a mostly reST or AsciiDoc corpus is a coverage gap, not a representative pass.

## Search And Routing Fields

| Field | Meaning |
| --- | --- |
| `search_auth_good` | Human judgment for whether the standard authentication search was useful. |
| `search_quickstart_good` | Human judgment for whether the standard quickstart search was useful. |
| `topSearchResults` | Top five search results for standard and target-specific queries. |
| `routing_goals` | Number of task-routing goals evaluated with `agentdocs handoff` and `agentdocs verify-context`. |
| `routing_expected` | Number of routing goals with an explicit expected task-pack ID. |
| `routing_passed` | Expected routing goals whose selected task pack matched the expected ID list. |
| `routing_failed` | Expected routing goals whose selected task pack was missing or unexpected. |
| `routing_accuracy` | `routing_passed / routing_expected`, or blank when no expected routes were declared. |

Routing classifications are deterministic:

| Classification | Meaning |
| --- | --- |
| `matched_exact` | Selected task pack is one of the expected task-pack IDs. |
| `matched_related` | A task pack was selected, but no expectation was declared or the selected pack was not expected. |
| `fallback` | No task pack was selected; AgentDocs fell back to source search and goal-bundle evidence. |
| `unsafe_mixed_context` | Verification found mixed task or search context, such as multiple versions or frameworks. |

Routing benchmarks are report-only unless a run declares `--expect-route`.

## Active Evaluation Token Fields

The active evaluation harness compares AgentDocs MCP with raw local and web-style
search controls. Its token fields are separate from dogfood routing metrics.

| Field | Meaning |
| --- | --- |
| `toolSchemaTokenEstimate` | Estimated tokens for all tools exposed to the model in a run. Kept for backward compatibility. |
| `toolSchemaMetrics.docsToolSchemaTokenEstimate` | Estimated tokens for AgentDocs MCP tool definitions such as `query_docs` and `read_page`. |
| `toolSchemaMetrics.rawDocsToolSchemaTokenEstimate` | Estimated tokens for raw-doc control tools such as `search_raw_docs`, `read_raw_doc`, `web_search`, and `fetch_webpage`. |
| `hotTokenEstimates.coldTotalTokens` | Provider-reported total tokens for the run. |
| `hotTokenEstimates.docsSchemaRepeatedTaxEstimate` | Analytical estimate of repeated AgentDocs MCP tool-schema tokens across turns. |
| `hotTokenEstimates.hotAdjustedTotalTokensEstimate` | Analytical estimate for an already-loaded AgentDocs session: cold total tokens minus repeated AgentDocs MCP tool-schema overhead. This is not a billing figure. |
| `retrievalPayloadTokenEstimate` | Estimated tokens returned by documentation retrieval tools. |
| `docsBytesReturned` | UTF-8 bytes returned by documentation retrieval tools. |
| `verification.publicSmokePassed` | Whether the visible fixture smoke test passed. |
| `verification.privateOraclePassed` | Whether the hidden final fixture oracle passed. This is the task-success gate used by north-star runs. |
| `contextDecisions` | Structured readiness observations captured from AgentDocs `query_docs` calls. Missing observations remain unknown. |
| `evidenceProtocol` | Evaluator-only evidence-use telemetry: readiness observations, cited references read, first-write timing, and blocked writes. It contains IDs and statuses, not source text. |
| `outcome` | Run classification: `success`, `task_failure`, `operational_failure`, or `dry_run`. |
| `failure.code` | Structured operational failure reason, such as `context_budget_exceeded`, `provider_tpm_limit`, or `provider_rate_limit`. |
| `tokenBudget` | Input/output request budgets and the peak estimated request-context tokens. |
| `rawCorpusFilesLoaded` | Number of text-like documentation files exposed to a raw control, including intentionally messy captured source material. |

North-star suite decisions are based on the hidden-oracle task result. A run
with `outcome=operational_failure` is a reliability failure and remains
`passed=false`, but it is not interpreted as a completed task attempt. The
aggregator reports planned-run reliability, task success among completed runs,
and whether each task/control comparison is comparable. Readiness
is diagnostic: an `implement` recommendation followed by a failed oracle is a
false-confidence signal, while `inspect` or `stop` followed by a successful
oracle is conservative behavior. Neither signal is converted into a success
score.

The dual gate emits `PASS`, `DO NOT ADVANCE`, or `INCONCLUSIVE`. Control TPM
overflows remain visible reliability failures; they cannot become task passes
or create a regression when the control lacks the required completed sample.

## Agent Task Field

`agent_task_passed` is a human judgment. It remains `unknown` until an agent
actually completes the target workflow using the generated AgentDocs context.
Readiness, search quality, and routing accuracy are supporting evidence, not a
replacement for this task result.

## Missing Metric Reasons

Use these labels instead of unexplained `N/A`:

| Reason | Meaning |
| --- | --- |
| `unsupported_format` | The docs corpus exists, but the dominant format is not parsed yet. |
| `scale_limited` | The corpus is supported but too large for the current run budget. |
| `scope_mismatch` | The selected source scope is not representative of the intended docs. |
| `retrieval_mismatch` | The build succeeded, but common task queries returned irrelevant material. |
| `historical_metric_not_captured` | The run predates this metric. |
| `preparation_blocked` | The target could not be prepared before AgentDocs ran. |

## Worked Example

If a row says:

```txt
pages=85, task_packs=7, readiness=93, repeat_build_hash_match=true,
routing_expected=2, routing_passed=1, routing_failed=1,
agent_task_passed=unknown
```

read it as:

AgentDocs compiled the target deterministically and produced strong audit
signals, but one declared task goal did not route to the expected task pack.
Because the implementation task has not been completed by an agent,
`agent_task_passed` stays `unknown`.
