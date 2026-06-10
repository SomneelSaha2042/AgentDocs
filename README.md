# AgentDocs

[![CI](https://github.com/SomneelSaha2042/AgentDocs/actions/workflows/ci.yml/badge.svg)](https://github.com/SomneelSaha2042/AgentDocs/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/agentdocs/beta.svg)](https://www.npmjs.com/package/agentdocs)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-339933.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Docs](https://img.shields.io/badge/docs-GitHub%20Pages-6f42c1.svg)](https://somneelsaha2042.github.io/AgentDocs/)

**Deterministic, local-first tooling that compiles existing technical documentation into an evidence-linked context layer for coding agents.**

AgentDocs turns Markdown, MDX, and public documentation websites into compact task packs, searchable artifacts, readiness findings, and read-only MCP tools. It does not require an LLM, execute commands found in documentation, or mutate source docs.

> **Beta status:** MVP phases 0-9 are implemented. The core ingest, crawl, build, audit, search, and MCP workflows are ready for real-repository testing.

## Install

AgentDocs requires Node.js 20 or later and supports Windows and Linux.

```bash
npm install --global agentdocs
agentdocs --version
```

Run without installing:

```bash
npx agentdocs@beta --help
```

Or add it to a project:

```bash
npm install --save-dev agentdocs
npx agentdocs init
```

See the [installation guide](https://somneelsaha2042.github.io/AgentDocs/guide/installation) for PowerShell and Linux setup details.

## Five-Minute Walkthrough

From the repository whose docs you want to compile:

```bash
agentdocs init
```

Review the generated `agentdocs.config.yaml`, then run:

```bash
agentdocs build
agentdocs doctor
agentdocs search "authentication"
```

AgentDocs writes a separate `.agentdocs/` context layer:

```txt
.agentdocs/
  llms.txt
  AGENTS.md
  manifest.json
  agent-map.json
  chunks.jsonl
  index.sqlite
  task-packs/*.md
  reports/agent-readiness.md
  reports/agent-readiness.json
```

The generated output is designed for task execution rather than document browsing:

- `llms.txt` provides a concise entry point.
- Generated `AGENTS.md` captures setup, concepts, tasks, and common mistakes.
- Task packs bundle evidence-backed instructions for detected task families.
- `agent-map.json` exposes pages, chunks, entities, edges, and evidence.
- `index.sqlite` provides ranked offline search.
- The readiness report identifies actionable documentation gaps.

## Website Documentation

Collect same-origin public documentation, then build completely offline:

```bash
agentdocs crawl https://docs.example.com
agentdocs build --skip-crawl
agentdocs doctor
```

Configured website sources are crawled automatically by `agentdocs build` unless `--skip-crawl` is passed. Crawled content is treated as untrusted input and commands in docs are never executed.

## Audit And Search

Use readiness scoring as a local or CI quality gate:

```bash
agentdocs doctor --min-score 80
agentdocs doctor --json
```

Search built artifacts without network access:

```bash
agentdocs search "webhook signature verification"
agentdocs search "API key" --json
```

## MCP

Expose only built AgentDocs artifacts to an MCP-compatible coding agent:

```bash
agentdocs serve-mcp
```

The server provides six read-only tools for search, pages, task packs, start context, code examples, and related pages. It cannot crawl, execute documentation commands, or read arbitrary filesystem paths.

See the [MCP setup guide](https://somneelsaha2042.github.io/AgentDocs/guide/search-mcp).

## How It Works

```txt
config and sources
        |
        v
ingest / crawl -> normalize -> chunk -> extract graph -> generate -> index -> audit
        |
        v
static artifacts + offline search + read-only MCP
```

AgentDocs uses stable IDs, deterministic ordering, explicit schemas, and evidence-linked outputs. When evidence is weak or missing, generated artifacts say so rather than inventing instructions.

## Engineering Quality

The beta is built as a strict TypeScript monorepo with focused package boundaries for collection, normalization, graph extraction, generation, readiness auditing, search, and MCP serving.

Release gates cover:

- deterministic fixture-based unit, snapshot, integration, and CLI tests;
- schema validation for generated JSON and JSONL artifacts;
- repeated-build artifact hash checks;
- SQLite/FTS5 search on Node 22 and deterministic lexical fallback on Node 20;
- Windows and Linux CI;
- npm tarball contents and clean global-install verification;
- real CLI workflow and MCP stdio smoke tests;
- path traversal, invalid artifacts, broken links, and untrusted-input behavior.

## Configuration

```yaml
name: Example Project
slug: example-project

sources:
  - type: local_markdown
    path: ./docs

output:
  dir: .agentdocs

doctor:
  minScore: 80
```

`agentdocs build` automatically collects configured local Markdown sources and websites. See the [configuration guide](https://somneelsaha2042.github.io/AgentDocs/reference/configuration).

## Current Limitations

- OpenAPI and repository source ingestion are planned but not implemented.
- Export is not implemented.
- Removing configured sources does not prune previously collected pages; use a fresh output directory when changing source sets.
- `build --clean` and additional inspect targets are not implemented.
- Broken-link checks do not validate heading fragments.
- The crawler is intended for public, statically accessible documentation.
- MCP implements the Phase 9 read-only surface, not every optional protocol feature.

## Contributing

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm test
pnpm docs:build
pnpm pack:verify
pnpm smoke:bundle
```

See [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request and
[SECURITY.md](SECURITY.md) for private vulnerability reporting. Repository
engineering rules are in [AGENTS.md](AGENTS.md). Product requirements and
contracts live in [PRD.md](PRD.md), [BUILD_PLAN.md](BUILD_PLAN.md), and
[APIS_AND_DOCUMENTATION.md](APIS_AND_DOCUMENTATION.md).

## License

[MIT](LICENSE)
