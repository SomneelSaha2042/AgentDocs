# AgentDocs Architecture

This document is the high-level design reference for the current AgentDocs
implementation. Keep it factual and update it whenever package
responsibilities, public contracts, pipeline behavior, generated artifacts,
readiness checks, search/MCP behavior, dependency relationships, test coverage,
CI behavior, or known gaps change.

Verified on 2026-07-22 during the deterministic context navigation pass.

## Product Shape

AgentDocs is a deterministic, local-first compiler and auditor for
agent-readable documentation. It collects existing documentation, normalizes it
into structured pages, extracts chunks/entities/edges, generates an
agent-facing context layer, builds offline search, and serves built artifacts
through CLI and read-only MCP surfaces.

The core pipeline does not require an LLM, hosted account, or network access
after explicit crawl or try collection has completed. Crawled and ingested
content is treated as untrusted input and is parsed as data, not executed.

## Workspace Packages

The repository is a strict TypeScript pnpm workspace with these packages:

| Package | Responsibility |
| --- | --- |
| `@somneelsaha/agentdocs` (`packages/cli`) | Published CLI, command routing, source collection orchestration, build/check/status lifecycle, workflow commands, export, and MCP server startup. |
| `@agentdocs/crawler` | Deterministic public website crawling, sitemap/link discovery, scope handling, raw HTML snapshots, and normalized Markdown page output. |
| `@agentdocs/normalizer` | Markdown/MDX/HTML/reST/AsciiDoc normalization, heading/link/code extraction, context facets, deterministic entity extraction helpers, and heading-aware chunking. |
| `@agentdocs/graph` | Entity and relationship graph construction from normalized pages, links (including already-captured cross-origin targets), extracted entities, and evidence. |
| `@agentdocs/generator` | Generated `llms.txt`, generated `AGENTS.md`, `agent-brief.md`, generic task packs with Markdown diagnostics and evidence-linked code examples, manifest, agent map, chunks JSONL, and artifact validation. |
| `@agentdocs/indexer` | Offline search index creation and querying. Uses Node SQLite/FTS5 when available and a deterministic lexical fallback otherwise. |
| `@agentdocs/doctor` | Agent-readiness checks, scoring, JSON report, and Markdown report generation. |
| `@agentdocs/mcp-server` | JSON-RPC stdio MCP surface over built artifacts and the local search index. |
| `@agentdocs/shared` | Zod schemas, shared TypeScript models, config loading, context bundle assembly, handoff bundle assembly, status models, and verification models. |

Internal dependency direction is intentionally simple:

```txt
cli -> crawler, normalizer, graph, generator, indexer, doctor, mcp-server, shared
crawler -> normalizer, shared
graph -> normalizer, shared
generator -> shared
indexer -> shared
doctor -> shared
mcp-server -> indexer, shared
normalizer -> shared
shared -> zod
```

## Implemented Pipeline

The implemented build path is:

```txt
config/source
  -> crawl or ingest
  -> normalize pages
  -> chunk by headings and content boundaries
  -> extract entities and relationships
  -> generate artifacts
  -> validate JSON/JSONL artifacts
  -> build search index
  -> run readiness checks
  -> serve CLI/MCP context from built artifacts
```

Local and repository ingestion supports Markdown, MDX, reST-like `.rst` and
`.txt`, and AsciiDoc/Antora `.adoc` and `.asciidoc` files where the normalizer
can compile them. Website crawling supports same-origin public HTML
documentation, scoped discovery, sitemap discovery, raw snapshots, Markdown
alternatives, and useful-page diagnostics.

Local and repository ingestion can also consume an explicitly supplied,
offline provenance sidecar. The sidecar is schema-validated, every matched
file is SHA-256 checked before normalization, and its source/canonical URLs are
carried onto `DocPage` records. The validated sidecar is copied beside the
ingest manifest; missing records are warnings and never trigger network
fetches.

OpenAPI is present in the data contracts as a future evidence type but is not implemented as an ingestion path. Configured `type: openapi` sources and direct OpenAPI file ingestion attempts are rejected early with an actionable unsupported-source error so schemas cannot leak into generic context.

## Public CLI Surface

Current CLI commands exposed by `agentdocs --help`:

```txt
init
try
context
handoff
setup-agent
status
verify-context
crawl
ingest
build
rebuild
watch
doctor
search
inspect
export
serve-mcp
```

The v1 golden workflow in `BUILD_PLAN.md` is:

```bash
agentdocs try <url-or-path> --goal "implement authentication"
agentdocs handoff "implement authentication"
agentdocs setup-agent
agentdocs serve-mcp
agentdocs verify-context --task "implement authentication"
agentdocs status
```

`try`, `context`, `handoff`, `setup-agent`, `status`, and `verify-context`
format existing shared result shapes for the golden workflow. Human output now
surfaces read-first resources, selected task packs, freshness, warnings, and
the configured MCP launch command where relevant. `context`, `handoff`, and
`verify-context` delegate context selection and verification through
`ArtifactService` into the shared `TaskContextAssembler` decision path.

## Generated Artifacts

Successful builds write the agent-facing layer under the configured output
directory, defaulting to `.agentdocs`:

```txt
llms.txt
AGENTS.md
agent-brief.md
manifest.json
agent-map.json
chunks.jsonl
index.sqlite
state/build-state.json
task-packs/*.md
reports/agent-readiness.md
reports/agent-readiness.json
```

Build-owned JSON and JSONL artifacts are schema-validated before a successful
build is reported. Task-pack diagnostics are rendered into generated Markdown
without changing the `TaskPack` schema in `agent-map.json`. Generated
`llms.txt` and generated `AGENTS.md` stay inside the output directory for local
builds so source documentation is not silently overwritten.
## Data Contracts

The canonical schemas live in `packages/shared/src/models.ts`. They cover:

- normalized document pages, headings, links, code blocks, chunks, and context
  facets;
- evidence records for pages, headings, links, code blocks, config, and future
  OpenAPI evidence;
- entities, edges, task packs, generated agent map, manifest, source coverage,
  search responses, query/read responses, context bundles, handoff bundles,
  build state, status reports, context verification, and readiness reports.

Stable IDs are derived deterministically from source identity, heading/content
location, and content hashes. Evidence-linked outputs should point back to
source pages, headings, code blocks, links, or config. OpenAPI evidence is reserved for a future opt-in adapter.

## Normalization Notes

Current normalizer behavior verified from package tests and implementation:

- Markdown chunking is heading-aware and keeps fenced code blocks intact,
  including oversized, unterminated, and nested fenced examples.
- Short setup prose that fits in a normal chunk can stay with an oversized code
  block so downstream scoring can associate explanation with code evidence.
- MDX parsing first attempts strict `remark-mdx`; tolerant fallback preserves
  headings, links, readable prose, and fenced code while replacing unsupported
  imports, exports, JSX, and brace expressions outside fenced code with
  deterministic omission markers and warnings.
- Entity extraction is regex/state-machine based and does not execute source
  content.

## Search And Context

`packages/indexer` builds offline search over pages, headings, chunks, facets,
and task-pack links. On runtimes with `node:sqlite` and FTS5, the MCP/CLI read
path keeps one validated SQLite reader open per service and asks FTS5 for a
bounded candidate set before applying task/facet filters. Otherwise it loads a
deterministic lexical fallback index. The public one-shot search helper closes
its reader after each call.

`packages/shared/src/task-context.ts` contains the public
`TaskContextAssembler` interface and its internal evidence-planning seam. It
owns the shared context decision path for task-pack selection, read-first
resources, warnings, verification issues, citations, confidence, context
bundles, handoff bundles, and `query_docs` style responses. Task-pack selection
is a navigational prior only: global search and requirement-anchor searches
remain available after a pack is selected. Evidence selection prioritizes
deterministic requirement coverage and source specificity, with task-pack
membership used only as a relevance signal.

The assembler applies a corpus-derived facet-safety pass for implementation
context. Explicit requested facets remain authoritative; inferred facets are
limited to unambiguous values already present in the built artifacts, with no
framework/package vocabulary embedded in serving code. If available evidence
contains incompatible exclusive facet values, `query_docs` emits a
`preferred_context_mismatch` warning and `verify_task_context` reports a
critical issue.

The same decision performs conservative task-readiness assessment over the
complete goal and task text. It extracts code/configuration symbols, explicit
constraints, and bounded high-signal phrases, then checks selected evidence
and corpus candidates. `query_docs` emits a requirement-directed first
response: source-backed summaries per selected requirement, a compact coverage
plan, and exact chunk/code-block follow-up refs. It does not serialize every
ranked chunk. `verify_task_context` exposes full evidence-linked assessments.
Missing candidates produce `stop`, candidate-but-unread evidence
produces `inspect`, and complete compatible evidence produces `implement`.
This is evidence assurance, not a guarantee that generated code will pass
arbitrary project tests.
The assembler also derives a `ContextNavigationCatalog` from the validated
`AgentMap` at serving time. The catalog projects matched pages into heading
paths, child counts, facets, evidence kinds, and exact `read_page` refs. It
accepts page/heading scopes and a deterministic continuation cursor so an agent
can progressively inspect a large map without truncating source evidence.
Un-ingested external links are surfaced as `external_uningested` references
with their source ref; the server never fetches them and does not treat them as
local evidence.
`packages/mcp-server/src/artifacts.ts` remains the
artifact-loading and search adapter over built files. It supplies a search
callback to the shared assembler; CLI and MCP surfaces format or expose the
shared result shapes.

Generated agent guidance and evaluator prompts use the same generic evidence
protocol: agents start with `query_docs`, may refine with returned `scopeRefs`
or continue `navigationCursor`, `implement` permits writing, `inspect` requires reading every
required source reference, and `stop` requires resolving the warning before
implementation.
The MCP server is externally stateless while caching its validated index reader
and context assembler for the lifetime of a request handler. It exposes the
two-tool compact profile; enforcement in the active evaluation runner is
diagnostic and does not add package-specific routing logic. `query_docs` is
coverage-first: token estimates are telemetry and cannot remove source-backed
requirements or references. Navigation pagination is independent of source
reads, so a map can be continued without cutting off evidence. `read_page` accepts exact refs only and returns
lossless, deterministic continuation refs for sources that span multiple
transport parts.

## MCP Surface

`packages/mcp-server` implements JSON-RPC over stdio. It reads generated
artifacts and the local search index only. Implemented tools include:

```txt
query_docs
read_page
search_docs
get_page
get_task_pack
get_agent_start_context
list_available_tasks
get_task_context
verify_task_context
explain_warning
get_setup_commands
get_version_policy
get_code_examples
find_code_examples
get_related_pages
```

Resources include the generated top-level artifacts, task packs, and page
content through `agentdocs://` URIs. `serve-mcp --tools` filters `tools/list`
and rejects disallowed `tools/call` requests before tool dispatch with a
structured `TOOL_NOT_ALLOWED` tool error. Generated setup snippets use the
compact `query_docs,read_page` profile to reduce normal-session tool-schema
overhead; bare `serve-mcp` continues to expose the full read-only surface.

## Readiness Scoring

`packages/doctor` produces deterministic readiness checks across
discoverability, structure, task coverage, version safety, agent safety, and
runtime readiness. Reports include pass/warn/fail counts, score impact,
evidence, and recommended next actions.

The score can be capped or reduced for issues such as no useful pages, weak
source coverage, missing generated artifacts, missing task packs, giant pages,
deprecated markers, security-warning gaps, and environment-variable evidence
gaps.

## Tests And Gates

Package tests are implemented with Vitest. Current visible test coverage
includes:

- shared schema and task-context tests;
- normalizer tests for Markdown, MDX, HTML, reST, AsciiDoc, extraction,
  context facets, and chunking;
- crawler tests;
- graph tests and snapshots;
- generator tests and snapshots;
- doctor readiness tests;
- indexer search tests;
- MCP artifact/server tests, including scope, cursor, and invalid-reference
  behavior;
- CLI tests for build, crawl, ingest, context/workflow, doctor, inspect, try,
  search, includes, exit codes, and command behavior.

Repository scripts include:

```bash
corepack pnpm build
corepack pnpm typecheck
corepack pnpm test
corepack pnpm regression:fixtures
corepack pnpm docs:build
corepack pnpm pack:verify
corepack pnpm smoke:bundle
corepack pnpm test:evaluation
```

The active evaluation harness is deliberately outside the deterministic
product pipeline. `scripts/eval-suite-runner.mjs` expands a declarative suite
into isolated seeded runs, while `scripts/eval-fixtures.mjs` validates source
snapshot hashes and required evidence before any model call. The north-star
pilot uses hidden final oracles in addition to visible fixture smoke tests;
private oracle files and fixture manifests are excluded from agent workspaces.
The Stripe webhook case is a provenance-complete holdout: its four Markdown
snapshots are captured from distinct official Stripe documentation URLs with
one capture timestamp, per-file hashes, and no task-specific required-evidence
rules. Experimental runs ingest each fixture's raw docs before building the
agent-facing artifacts, so they cannot silently reuse stale or prebuilt output.
Raw controls preserve the captured text-like corpus, including intentionally
messy Markdown/HTML/JSON and versioned source material when present. Each
provider request has a deterministic input/output budget; context overages and
provider TPM/rate-limit errors are persisted as operational failures and do
not crash the remaining suite runs. The evaluator allows MCP calls up to 60
seconds so dense deterministic context assembly is measured rather than
misclassified by a five-second client deadline. Experimental runs also record schema-v5
evidence-protocol telemetry without storing source text. The evaluation gate
requires the experimental arm to pass a majority of completed seeds for every
task (two of three in the standard suite) and not regress against either
complete control for that task. Experimental operational failures, failed
task-majority checks, or comparable task regressions are `DO_NOT_ADVANCE`;
incomplete control samples are `INCONCLUSIVE`; only a complete matrix that
meets both conditions is `PASS`.

The GitHub CI matrix in `.github/workflows/ci.yml` runs on Ubuntu Node 20,
Ubuntu Node 22, and Windows Node 20. It installs with the frozen lockfile, runs
high-severity audit, build, typecheck, tests, fixture regression, docs build,
package verification, bundle smoke, installed tarball smoke, and release smoke.

## Phase 0 Baseline

The Phase 0 baseline proof was captured in
`docs/results/v1-phase-0-baseline.md`.

Local target:

```bash
node packages/cli/dist/agentdocs.js --out .agentdocs-phase0-baseline try ./docs --goal "implement authentication" --json
```

Observed counts:

```txt
pages: 29
chunks: 201
entities: 170
edges: 360
taskPacks: 12
doctor score: 91/100
source coverage: 29 of 29 supported docs files compiled
artifact directory size: about 2.5 MiB
```

The sampled baseline also exposed a context-routing weakness: the goal
`connect MCP to Codex` selected the `pagination` task pack even though the
retrieved read-first pages were MCP/workflow related. This is not a Phase 0
blocker, but it is evidence for Phase 1/2 workflow and context-brain work.

## Phase 1 Workflow UX

The Phase 1 proof was captured in `docs/results/v1-phase-1-golden-workflow.md`.

Verified workflow target:

```bash
node packages/cli/dist/agentdocs.js --out .agentdocs-phase1-proof2 try fixtures/basic-docs --goal "create a client"
node packages/cli/dist/agentdocs.js --out .agentdocs-phase1-proof2 handoff "create a client"
node packages/cli/dist/agentdocs.js --out .agentdocs-phase1-proof2 setup-agent --client codex
node packages/cli/dist/agentdocs.js --out .agentdocs-phase1-proof2 verify-context --task "create a client"
node packages/cli/dist/agentdocs.js --out .agentdocs-phase1-proof2 status
```

Observed output includes selected task-pack labels, read-first resources,
freshness, context warnings, verification issues, and custom `--out` MCP launch
commands.

## Phase 2 One Context Brain

The Phase 2 proof was captured in
`docs/results/v1-phase-2-one-context-brain.md`.

The shared `TaskContextAssembler` now builds a single context decision used by
CLI `context`, CLI `handoff`, CLI `verify-context`, MCP `query_docs`, MCP
`get_task_context`, and MCP `verify_task_context`. The hardening-fixture proof
confirmed matching selected task packs and warnings across CLI and MCP for
`quickstart`, `build App Router POST route handler`, and `implement React
mutation invalidation`.

## Phase 3 Generic Compiler Hardening

The Phase 3 proof was captured in
`docs/results/v1-phase-3-generic-compiler-hardening.md`.

Default task-pack families are now generic: `quickstart`, `installation`,
`authentication`, `configuration`, `webhooks`, `pagination`, `errors`,
`migration`, `deployment`, `api-usage`, and `testing`. Domain-shaped IDs such
as `route-handlers`, `query-invalidation`, and `schema-validation` are no
longer built-ins and are generated only when provided through configured
`tasks`.

Task-pack ranking still starts from family keywords or configured task queries,
then uses generic evidence signals such as implementation verbs, HTTP routes,
request/response/schema terms, mutation/update terms, CLI commands, imports,
environment variables, loops/cursors, warnings, and deprecations. High
confidence requires implementation-shaped prose plus relevant code or command
evidence. Task-pack Markdown includes diagnostics for selected evidence,
code/command evidence, weak evidence, and context conflicts; `agent-map.json`
keeps the existing schema.

## Phase 4 Ingestion Contract Closure

The Phase 4 proof is captured in `docs/results/v1-phase-4-ingestion-contract-closure.md`.

The supported v1 source contract is now explicit: configured sources support `local_markdown`, `repo`, and `website`. Local/repo collection compiles Markdown, MDX, reST-like text, and AsciiDoc through the normalizer. OpenAPI ingestion is deferred and rejected early through config validation or direct ingest detection, which keeps API schemas out of default context until an opt-in adapter exists.

## Phase 5 Product Proof Runs

The Phase 5 proof is captured in `docs/results/v1-product-proof.md` and generated by `scripts/v1-product-proof.mjs`. The proof reuses prepared dogfood targets and adds same-goal CLI/MCP context captures for tiny, small, medium, large, and very large documentation corpora across Markdown, MDX, website-crawl, reST/Sphinx, AsciiDoc/Antora, and mixed reST sources.

The proof confirms stable repeated builds across the sampled targets and records routing results, parser/source-coverage warnings, doctor warnings, and approximate CLI/MCP context sizes as product evidence rather than agent-task success claims. After the intent-aware selector pass, 32 of 33 sampled workflows route to the expected generic task family; the remaining hardening-fixture auth/RLS workflow falls back because that fixture does not generate an authentication task pack.

## Known Gaps

- OpenAPI ingestion is deferred to a future opt-in adapter. Current builds reject configured OpenAPI sources and direct OpenAPI file ingestion early instead of silently compiling schemas into generic context.
- Task selection can only choose generated task packs. If the compiler does not generate an organic task pack for a requested family, context falls back to source-ranked sections and verification reports the missing task pack.
- The current `inspect` command covers generated entities, links, and task-pack
  explanations; broader inspect targets in older product text should be treated
  as not implemented unless verified.
- Website freshness uses configured TTLs rather than live network
  revalidation, by design.
- The north-star evaluation suite is not a product guarantee. Its result is
  only valid when fixture evidence, hidden-oracle status, corpus hashes, and
  contamination checks are all present; historical runs without those fields
  remain backward-compatible but cannot be treated as equivalent evidence.
