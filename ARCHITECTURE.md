# AgentDocs Architecture

This document is the high-level design reference for the current AgentDocs
implementation. Keep it factual and update it whenever package
responsibilities, public contracts, pipeline behavior, generated artifacts,
readiness checks, search/MCP behavior, dependency relationships, test coverage,
CI behavior, or known gaps change.

Verified on 2026-06-30 during the Phase 0 baseline pass.

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
| `@agentdocs/graph` | Entity and relationship graph construction from normalized pages, links, extracted entities, and evidence. |
| `@agentdocs/generator` | Generated `llms.txt`, generated `AGENTS.md`, `agent-brief.md`, task packs, manifest, agent map, chunks JSONL, and artifact validation. |
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

OpenAPI is present in the config and data contracts but is not implemented as
an ingestion path. Phase 4 of `BUILD_PLAN.md` must either add minimal
deterministic local OpenAPI ingestion or reject OpenAPI sources early with an
actionable unsupported-source error.

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
the configured MCP launch command where relevant. `context`, `handoff`,
`verify-context`, and several MCP tools assemble context through shared models
in `packages/shared`, but the Phase 2 plan still needs to ensure CLI and MCP
delegate all selection, warning, citation, and confidence behavior to one shared
context module.

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
build is reported. Generated `llms.txt` and generated `AGENTS.md` stay inside
the output directory for local builds so source documentation is not silently
overwritten.

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
source pages, headings, code blocks, links, config, or OpenAPI data when that
source type is implemented.

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
and task-pack links. On runtimes with `node:sqlite` and FTS5, it uses SQLite
FTS5. Otherwise it writes a deterministic lexical fallback index to the same
`index.sqlite` path.

`packages/shared/src/task-context.ts` contains the current
`TaskContextAssembler`. It selects a relevant task pack, ranks chunks, extracts
steps/code examples/gotchas/citations, estimates token size, and builds
`query_docs` style responses. `packages/cli/src/context.ts` and
`packages/cli/src/workflow.ts` format context and handoff outputs on top of
shared models.

Known product gap: Phase 2 must remove or reduce remaining duplicated
selection/verification logic between CLI and MCP adapters so the same goal gets
the same task pack, warnings, citations, and confidence across surfaces.

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
structured `TOOL_NOT_ALLOWED` tool error.

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
- MCP artifact/server tests;
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
```

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

## Known Gaps

- OpenAPI sources are represented in schemas/config but are not implemented as
  an ingestion path.
- Context selection is partly shared but still needs Phase 2 consolidation so
  CLI and MCP outputs agree for the same goal.
- Default generated task families still include domain-shaped names such as
  `route-handlers`, `query-invalidation`, and `schema-validation`; Phase 3 must
  ensure defaults stay generic and do not violate the no-evaluation-gaming
  rule.
- The current `inspect` command covers generated entities, links, and task-pack
  explanations; broader inspect targets in older product text should be treated
  as not implemented unless verified.
- Website freshness uses configured TTLs rather than live network
  revalidation, by design.
