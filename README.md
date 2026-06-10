# AgentDocs

**Deterministic, local-first tooling that compiles existing technical documentation into an evidence-linked context layer for coding agents.**

AgentDocs turns Markdown, MDX, and public documentation websites into compact, task-oriented artifacts that agents can navigate and audit. It runs locally, does not require an LLM, never executes commands found in documentation, and keeps every generated recommendation traceable to source evidence.

> **Project status:** Active development. Phases 0-8 are implemented, covering ingestion, crawling, normalization, chunking, graph extraction, artifact generation, readiness auditing, and offline search. Export and MCP serving are planned.

## What AgentDocs Produces

```txt
Existing documentation
        |
        v
ingest / crawl -> normalize -> chunk -> extract graph -> generate -> audit
        |
        v
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

The output is designed for task execution rather than document browsing:

- `llms.txt` provides a concise entry point and navigation map.
- Generated `AGENTS.md` captures setup, concepts, common tasks, and common mistakes.
- Task packs bundle evidence-backed instructions for detected task families.
- `agent-map.json` exposes pages, chunks, entities, edges, and task packs as structured data.
- `index.sqlite` provides ranked offline search over titles, headings, and chunks.
- The readiness report identifies concrete documentation gaps and their supporting evidence.

## Why AgentDocs

- **Deterministic first:** core builds and audits work without an LLM.
- **Evidence linked:** generated steps, entities, and findings point back to source material.
- **Local first:** artifacts are generated locally with no account or hosted service required.
- **Offline after collection:** builds and audits do not require network access after ingest or crawl.
- **Untrusted-input aware:** documentation code blocks and commands are parsed, never executed.
- **Schema validated:** JSON and JSONL artifacts are validated before a build succeeds.
- **Source preserving:** AgentDocs writes a separate context layer and does not mutate source docs.

## Quick Start

AgentDocs currently runs from this repository and requires Node.js 20 or later with pnpm.

```bash
pnpm install --frozen-lockfile
pnpm build
```

Build agent artifacts from the included Markdown fixture:

```bash
pnpm exec agentdocs ingest fixtures/basic-docs --out .agentdocs-test
pnpm exec agentdocs build --skip-crawl --out .agentdocs-test
pnpm exec agentdocs doctor --out .agentdocs-test
pnpm exec agentdocs search "API key" --out .agentdocs-test
```

Inspect the generated output:

```bash
pnpm exec agentdocs inspect entities --out .agentdocs-test
pnpm exec agentdocs inspect links --out .agentdocs-test
```

## Common Workflows

### Local Markdown and MDX

```bash
pnpm exec agentdocs ingest ./docs
pnpm exec agentdocs build --skip-crawl
pnpm exec agentdocs doctor
```

### Public Documentation Website

```bash
pnpm exec agentdocs crawl https://docs.example.com
pnpm exec agentdocs build --skip-crawl
pnpm exec agentdocs doctor
```

Website crawling stays on the configured origin by default, supports sitemap discovery and fallback link crawling, and can respect `robots.txt`. Crawled content is treated as untrusted input.

### Enforce a Readiness Threshold

```bash
pnpm exec agentdocs doctor --min-score 80
```

The doctor command exits with code `5` when the overall readiness score is below the configured threshold, making it suitable for CI gates.

## Generated Artifacts

| Artifact | Purpose |
| --- | --- |
| `llms.txt` | Concise agent-facing navigation and project rules |
| `AGENTS.md` | Generated setup, concepts, tasks, mistakes, and source links |
| `manifest.json` | Build metadata and artifact inventory |
| `agent-map.json` | Machine-readable pages, chunks, entities, edges, and task packs |
| `chunks.jsonl` | Stable, source-linked normalized chunks |
| `index.sqlite` | Offline FTS5 or deterministic fallback lexical search index |
| `task-packs/*.md` | Compact instructions grouped by detected task family |
| `reports/agent-readiness.md` | Human-readable readiness findings |
| `reports/agent-readiness.json` | Machine-readable readiness findings |

The default output directory is `.agentdocs`. Use `--out <directory>` or configure `output.dir` to change it.

## Readiness Audit

`agentdocs doctor` evaluates six categories:

| Category | What It Evaluates |
| --- | --- |
| Discoverability | Whether agents can find useful starting points |
| Structure | Whether content is organized into usable chunks and relationships |
| Task coverage | Whether common task families have supporting documentation |
| Version safety | Whether version and deprecation signals are clear |
| Agent safety | Whether generated guidance avoids unsupported assumptions |
| Runtime readiness | Whether generated artifacts are complete and internally consistent |

Findings are deterministic, actionable, and linked to inspected evidence. Use `--json` for machine-readable command output or `--category <name>` to focus an audit.

## Configuration

Create a starter configuration:

```bash
pnpm exec agentdocs init
```

Example `agentdocs.config.yaml`:

```yaml
name: Example Project

sources:
  - type: local_markdown
    path: ./docs

output:
  dir: .agentdocs

doctor:
  minScore: 80
```

Configuration and command contracts are documented in [APIS_AND_DOCUMENTATION.md](APIS_AND_DOCUMENTATION.md).

## CLI Status

| Command | Status | Description |
| --- | --- | --- |
| `agentdocs init` | Ready | Create a starter configuration |
| `agentdocs ingest` | Ready | Ingest local Markdown and MDX |
| `agentdocs crawl` | Ready | Crawl same-origin public HTML documentation |
| `agentdocs build` | Ready | Generate artifacts from collected source state |
| `agentdocs doctor` | Ready | Generate readiness reports and enforce score thresholds |
| `agentdocs inspect entities` | Ready | Inspect extracted entities |
| `agentdocs inspect links` | Ready | Inspect extracted links |
| `agentdocs search` | Ready | Search titles, headings, and chunks offline |
| `agentdocs export` | Planned | Export selected generated content |
| `agentdocs serve-mcp` | Planned | Serve built artifacts through MCP |

Run `pnpm exec agentdocs --help` or `pnpm exec agentdocs <command> --help` for the current command-line interface.

## Architecture

The implementation is split into focused TypeScript packages:

| Package | Responsibility |
| --- | --- |
| `packages/shared` | Schemas, configuration, IDs, errors, and shared models |
| `packages/cli` | Command-line interface and workflow orchestration |
| `packages/crawler` | Same-origin website collection |
| `packages/normalizer` | Markdown normalization and deterministic chunking |
| `packages/graph` | Entity and relationship extraction |
| `packages/generator` | Agent-facing artifact and task-pack generation |
| `packages/doctor` | Readiness scoring, findings, and reports |

## Development

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm test
```

Tests are deterministic and do not make network calls by default.

## Current Limitations

- Export and MCP serving are not implemented yet.
- Node.js runtimes without `node:sqlite` or FTS5 build a deterministic lexical fallback at `index.sqlite`.
- OpenAPI and repository source declarations are recognized by configuration but are not yet ingested.
- Broken-link checks do not validate heading fragments.
- Oversized fenced code blocks may exceed normal chunk-size guidance.
- Identical source-relative paths across multiple sources can be ambiguous.
- `robots.txt` handling does not yet implement the complete specification.

See [BUILD_PLAN.md](BUILD_PLAN.md) for phase gates and planned work.

## Project Documentation

- [PRD.md](PRD.md): product requirements and scope
- [BUILD_PLAN.md](BUILD_PLAN.md): phased implementation plan and gates
- [APIS_AND_DOCUMENTATION.md](APIS_AND_DOCUMENTATION.md): CLI, API, and data-model contracts
- [AGENTS.md](AGENTS.md): repository engineering rules
- [fixtures/README.md](fixtures/README.md): fixture catalog and coverage

## License

MIT
