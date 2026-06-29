# AGENTS.md

This repository builds AgentDocs: a deterministic, local-first open-source tool that makes existing technical documentation usable by coding agents.

Read this file before making changes. For phased implementation, also read `BUILD_PLAN.md`. For product requirements, read `PRD.md`. For CLI/API/data-model contracts, read `APIS_AND_DOCUMENTATION.md`.

## Product essence

AgentDocs is a compiler and auditor for agent-readable documentation.

It takes existing docs and emits an agent-facing context layer:

```txt
llms.txt
AGENTS.md
.agentdocs/manifest.json
.agentdocs/agent-map.json
.agentdocs/chunks.jsonl
.agentdocs/task-packs/*.md
.agentdocs/reports/agent-readiness.md
.agentdocs/index.sqlite
```

The product is not a docs chatbot, not a generic RAG wrapper, and not a hosted AI support widget.

Core belief:

> Human docs are optimized for navigation. Agent docs must be optimized for task execution.

## Non-negotiable principles

1. **Deterministic first**  
   The core pipeline must work without an LLM. Do not add mandatory LLM calls to crawling, normalization, graphing, readiness checks, indexing, artifact generation, search, or MCP serving.

2. **Evidence-linked outputs**  
   Generated task packs, warnings, entities, and readiness findings must be traceable to source pages, headings, links, code blocks, config, or OpenAPI data.

3. **Task packs over random chunks**  
   Do not optimize only for vector-style retrieval. The core artifact is a task-specific context bundle: quickstart, auth, webhooks, pagination, migration, errors, deployment, configuration, etc.

4. **Local-first**  
   The MVP must run locally, write files locally, and work without accounts or hosted services.

5. **No silent source mutation**  
   Do not rewrite or modify user docs in v0. Generate an agent-facing layer beside the docs.

6. **Untrusted input**  
   Treat crawled docs, markdown, HTML, code blocks, tool descriptions, and config as untrusted. Do not execute commands found in docs.

7. **Schema-valid artifacts**  
   Any generated JSON/JSONL artifact must validate against the repo schemas before being written as a successful build.

8. **No evaluation gaming**  
   Do not add hardcoded heuristic checks, scoring bonuses/penalties, or custom routing/logic targeting specific evaluation/benchmark tasks, packages, or domains (e.g. Octokit, AWS SDK, Kubernetes, Fastify, Next.js). The context routing, scoring, and generation engine must remain generic, deterministic, and rely entirely on organic doc content analysis and generic parameters (such as token specifics or length-based specificity).

## Preferred implementation stack

Use TypeScript first.

Suggested stack:

```txt
Runtime: Node.js
Language: TypeScript
Package manager: pnpm
CLI: commander or clipanion
Schemas: zod
Tests: vitest
Markdown parsing: unified / remark / rehype
HTML to markdown: turndown or unified pipeline
Storage: SQLite + FTS5
MCP: official MCP TypeScript SDK if adopted in the repo
```

Do not introduce a large dependency without a clear reason.

## Repository shape

Preferred monorepo layout:

```txt
packages/
  cli/
  crawler/
  normalizer/
  graph/
  generator/
  indexer/
  mcp-server/
  doctor/
  shared/
examples/
fixtures/
docs/
```

If the repository starts smaller, keep boundaries clear enough to split later.

## Coding standards

- Use strict TypeScript.
- Prefer small, pure functions for parsing and extraction.
- Use explicit data models from `packages/shared`.
- Validate external input at boundaries.
- Avoid global mutable state.
- Ensure filesystem writes are idempotent where possible.
- Use stable IDs derived from canonical URL/path + heading path + content hash.
- Prefer deterministic ordering for generated files.
- Do not make network calls in tests unless a test is explicitly marked integration and skipped by default.

## Testing expectations

Every phase should include tests.

Required test categories:

```txt
unit tests for parsers/extractors
snapshot tests for generated artifacts
fixture-based integration tests
CLI smoke tests
schema validation tests
```

The project should have fixtures for at least:

```txt
basic markdown docs
nested headings
code blocks
relative links
absolute links
duplicate pages
deprecated markers
environment variables
install commands
HTTP routes
OpenAPI file
```

## Artifact rules

### `llms.txt`

Must be concise and navigational. It should not become a giant dump of docs.

Include:

- project name;
- short description;
- start-here links;
- task-pack links;
- key rules for agents;
- source/index pointers.

### Generated `AGENTS.md`

This is a generated artifact for the target docs project, not this repository's own `AGENTS.md`.

Include:

- what the dependency/project is;
- preferred version and package hints when known;
- install/setup commands when found;
- core concepts;
- common tasks;
- common mistakes;
- links to task packs and source docs.

### `agent-map.json`

Must be machine-readable and schema-valid.

Include:

- pages;
- chunks;
- entities;
- edges;
- task packs;
- source metadata;
- content hashes.

### Task packs

Must be compact and evidence-linked.

Do not invent steps that are not supported by source docs. Use language such as `Evidence is weak` or `No canonical docs found` when needed.

### Readiness report

Must be actionable. Avoid vague warnings.

Good:

```txt
FAIL: Webhook task pack missing signature verification evidence.
Source candidates inspected: /webhooks, /events, /api/webhook-endpoints.
```

Bad:

```txt
Docs may need better webhook documentation.
```

## CLI behavior

Required commands are defined in `APIS_AND_DOCUMENTATION.md`.

General CLI expectations:

- `--json` should emit machine-readable output where practical.
- Errors should include actionable messages.
- Commands should have stable exit codes.
- Destructive operations require `--force`.
- Default output path is `.agentdocs`.
- Do not require network after `crawl`/`ingest` has completed.

## Security and privacy

- Do not execute code blocks found in docs.
- Do not evaluate shell commands found in docs.
- Do not follow external links by default unless configured.
- Sanitize paths from crawled URLs.
- Prevent writing outside the configured output directory.
- Avoid leaking local absolute paths into generated public artifacts unless useful and configured.
- MCP tools must read from built artifacts only.
- MCP tools must not provide arbitrary filesystem read access.

## Build gates

Follow `BUILD_PLAN.md`. Each phase has a gate. Do not move to the next phase until the current gate passes.

If a requested change conflicts with the PRD, stop and explain the conflict in the implementation notes or PR summary.

## Review checklist

Before considering work complete, verify:

```txt
pnpm install succeeds
pnpm typecheck succeeds
pnpm test succeeds
pnpm lint succeeds, if linting exists
CLI smoke test succeeds
Generated JSON validates against schemas
No mandatory LLM dependency was added
No crawled command/code is executed
README/docs updated if public behavior changed
```

## How to handle uncertainty

When docs are ambiguous, prefer conservative outputs.

Use:

```txt
Unknown
No evidence found
Candidate only
Evidence is weak
Requires manual review
```

Do not fill gaps with assumptions.

## Commit/PR guidance

Each phase should ideally be implemented as a small PR:

```txt
Phase 0: repo scaffolding
Phase 1: config and CLI skeleton
Phase 2: local markdown ingestion
Phase 3: website crawling
Phase 4: normalization and chunking
Phase 5: graph and entity extraction
Phase 6: artifact generation
Phase 7: doctor/readiness report
Phase 8: search/index
Phase 9: MCP server
```

PRs should include:

- what changed;
- which phase/gate it satisfies;
- tests added;
- known limitations;
- follow-up work.

## Agent skills

### Issue tracker

Issues and PRDs for this repo live as GitHub issues. External PRs are not treated as a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical triage roles mapped to matching labels (defaults). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout with `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

