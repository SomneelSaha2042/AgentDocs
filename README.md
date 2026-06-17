<p align="center">
  <img src="./docs/public/brand/hero-agentdocs.png" width="360" alt="AgentDocs compiling documentation into structured context for coding agents" />
</p>

# AgentDocs

[![CI](https://github.com/SomneelSaha2042/AgentDocs/actions/workflows/ci.yml/badge.svg)](https://github.com/SomneelSaha2042/AgentDocs/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@somneelsaha/agentdocs/beta.svg)](https://www.npmjs.com/package/@somneelsaha/agentdocs)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-339933.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Docs](https://img.shields.io/badge/docs-GitHub%20Pages-6f42c1.svg)](https://somneelsaha2042.github.io/AgentDocs/)

**Deterministic, local-first tooling that compiles existing technical documentation into an evidence-linked context layer for coding agents.**

AgentDocs turns Markdown, MDX, and public documentation websites into compact task packs, searchable artifacts, readiness findings, and read-only MCP tools. It does not require an LLM, execute commands found in documentation, or mutate source docs.

> **Usable beta:** AgentDocs is published on npm as
> `@somneelsaha/agentdocs` and can be installed today with Node.js 20 or later.
> MVP phases 0-9, the June 2026 hardening work, and the agent workflow layer
> are implemented for real-repository testing.
>
> It is still beta software: OpenAPI ingestion and export are not implemented,
> and large or unusual docs sites may need scoped crawl settings. The core
> compile, audit, search, handoff, freshness, and MCP workflows are usable.

## Install

AgentDocs requires Node.js 20 or later and supports Windows and Linux.

```bash
npm install --global @somneelsaha/agentdocs
agentdocs --version
```

Run without installing:

```bash
npx @somneelsaha/agentdocs@beta --help
npx @somneelsaha/agentdocs@beta --version
```

Turn a docs URL or local Markdown path into a coding-agent handoff in one
command:

```bash
npx @somneelsaha/agentdocs@beta try https://docs.example.com --goal "implement authentication"
```

Or add it to a project:

```bash
npm install --save-dev @somneelsaha/agentdocs
npx agentdocs init
```

The `beta` dist-tag currently tracks the published beta line. Pin an explicit
version such as `@somneelsaha/agentdocs@0.1.0-beta.4` when you need a
reproducible install.

See the [installation guide](https://somneelsaha2042.github.io/AgentDocs/guide/installation) for PowerShell and Linux setup details.

## Five-Minute Walkthrough

For a one-command trial, run:

```bash
agentdocs try ./docs --goal "implement authentication"
```

This collects the docs, builds and audits the context layer, finds evidence for
the goal, and prints the exact MCP command and coding-agent prompt to use next.
For large multi-product sites, AgentDocs infers the nearest product/version
guide scope instead of attempting to mirror the entire documentation domain.

Reuse the built context without crawling again:

```bash
agentdocs status
agentdocs handoff "implement authentication"
```

`handoff` is the recommended multi-session command. It wraps the compact
`context` bundle with freshness, selected task pack, source pages, gotchas,
setup commands, and MCP tool/resource suggestions. The older
`agentdocs context "<goal>"` command remains available for the smaller bundle.

For a maintained project configuration, start from the repository whose docs
you want to compile:

```bash
agentdocs init
```

Review the generated `agentdocs.config.yaml`, then run:

```bash
agentdocs build
agentdocs doctor
agentdocs search "authentication"
```

Keep version, framework, router, or runtime-specific results inside an explicit
context boundary:

```bash
agentdocs search "migration" --facet version=v5
agentdocs search "query invalidation" --facet framework=react
agentdocs verify-context --task "build Fastify v5 route" --facet version=v5
```

AgentDocs writes a separate `.agentdocs/` context layer:

```txt
.agentdocs/
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

The generated output is designed for task execution rather than document browsing:

- `llms.txt` provides a concise entry point.
- Generated `AGENTS.md` captures setup, concepts, tasks, and common mistakes.
- `agent-brief.md` is the first persistent file to show a coding agent.
- Task packs bundle evidence-backed instructions for detected task families.
- `agent-map.json` exposes pages, chunks, entities, edges, context facets, and evidence.
- `index.sqlite` provides ranked offline search.
- `state/build-state.json` powers freshness checks and changed-source rebuilds.
- The readiness report identifies actionable gaps and caps scores when critical
  task context conflicts remain.

## Website Documentation

Collect same-origin public documentation, then build completely offline:

```bash
agentdocs crawl https://docs.example.com
agentdocs build --skip-crawl
agentdocs doctor
```

Configured website sources are crawled automatically by `agentdocs build` unless `--skip-crawl` is passed. Crawled content is treated as untrusted input and commands in docs are never executed.

The crawler starts from the supplied page, follows redirects, infers a nearby
guide scope, discovers sitemaps from `robots.txt` or `/sitemap.xml`, supplements
them with scoped links, and prefers official same-origin Markdown alternatives
when available. Use explicit `--include` patterns to override inferred scope.

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
agentdocs search "migration" --facet version=v5
agentdocs inspect task-pack quickstart
```

Unfiltered searches emit machine-readable warnings when top results mix
exclusive context such as versions, frameworks, routers, or runtimes.

## MCP

Expose only built AgentDocs artifacts to an MCP-compatible coding agent:

```bash
agentdocs setup-agent --client codex
agentdocs serve-mcp
```

The server provides read-only tools for search, pages, task packs, task handoff,
context verification, setup commands, version policy, code examples, and related
pages. It cannot crawl, execute documentation commands, or read arbitrary
filesystem paths.

For multi-session work, run `agentdocs status` before starting. Reuse existing
artifacts when fresh, or run `agentdocs rebuild --changed` after local docs
change. `agentdocs watch --once` performs the same check once; without `--once`,
it polls and rebuilds when freshness changes.

See the [MCP setup guide](https://somneelsaha2042.github.io/AgentDocs/guide/search-mcp).
The [agent workflow guide](https://somneelsaha2042.github.io/AgentDocs/guide/agent-workflow)
explains the design tradeoffs behind handoff, freshness, verification, and MCP
client setup.
Real-repository pass criteria and current failures are tracked in the
[dogfood workflow matrix](https://somneelsaha2042.github.io/AgentDocs/guide/workflow-matrix).

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

AgentDocs uses stable IDs, deterministic ordering, explicit schemas, and
evidence-linked outputs. When evidence is weak or missing, generated artifacts
say so rather than inventing instructions.

The workflow layer follows the same rule. Freshness is computed from local
source hashes, website TTLs, config hashes, and build-owned artifact hashes.
Context verification is deterministic: it checks stale artifacts, mixed
exclusive facets, deprecated evidence, weak task packs, missing canonical
sources, and requested facet mismatches. No LLM decides whether context is safe.

Two tradeoffs are deliberate:

- Website freshness uses a TTL instead of live network revalidation so
  `agentdocs status` stays local and predictable.
- `setup-agent` prints copy-paste snippets instead of silently editing client
  config files, because agent clients change formats and developers should stay
  in control of their editor/assistant settings.

## Published Beta

The CLI is distributed as the scoped npm package
`@somneelsaha/agentdocs`. Installing it exposes the `agentdocs` binary:

```bash
npm install --global @somneelsaha/agentdocs
agentdocs try ./docs --goal "implement authentication"
```

Release verification builds the bundled CLI, checks the packed npm contents,
installs the tarball, runs CLI and MCP smoke tests, and publishes future beta
tags through npm trusted publishing with provenance.

## Engineering Quality

The beta is built as a strict TypeScript monorepo with focused package boundaries for collection, normalization, graph extraction, generation, readiness auditing, search, and MCP serving.

Release gates cover:

- deterministic fixture-based unit, snapshot, integration, and CLI tests;
- an offline hardening regression for mixed context, tolerant MDX, and task-pack routing;
- schema validation for generated JSON and JSONL artifacts;
- repeated-build artifact hash checks;
- SQLite/FTS5 search on Node 22 and deterministic lexical fallback on Node 20;
- Linux Node 20/22 and Windows Node 20 CI;
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
  - type: repo
    path: .
    include: ["packages/*/docs/**/*.md"]

context:
  preferred:
    version: v5
    framework: react
  exclusiveKeys: [version, framework, router, runtime]

normalization:
  mdx: tolerant

output:
  dir: .agentdocs

doctor:
  minScore: 80
```

`agentdocs build` automatically collects configured local Markdown, repository,
and website sources. Repository sources reuse local ingestion and never clone.
See the [configuration guide](https://somneelsaha2042.github.io/AgentDocs/reference/configuration).

## Current Limitations

- OpenAPI ingestion is recognized but not implemented.
- Export is not implemented.
- Removing configured sources does not prune previously collected pages; use a fresh output directory when changing source sets.
- `build --clean` and additional inspect targets beyond entities, links, and task-pack explanations are not implemented.
- Broken-link checks do not validate heading fragments.
- The crawler is intended for public, statically accessible documentation.
- Full-origin archival crawls and JavaScript-rendered-only documentation are not
  targets of the current scoped crawler.
- MCP implements the Phase 9 read-only surface, not every optional protocol feature.

## Contributing

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm test
pnpm regression:fixtures
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
