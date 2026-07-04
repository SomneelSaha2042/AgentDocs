<p align="center">
  <img src="./assets/agentdocs-icon-pack/brand/hero-agentdocs.png" width="560" alt="AgentDocs pixel detective mascot holding documentation and an audit checklist." />
</p>

# AgentDocs

[![CI](https://github.com/SomneelSaha2042/AgentDocs/actions/workflows/ci.yml/badge.svg)](https://github.com/SomneelSaha2042/AgentDocs/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@somneelsaha/agentdocs/beta.svg)](https://www.npmjs.com/package/@somneelsaha/agentdocs)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-339933.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Docs](https://img.shields.io/badge/docs-GitHub%20Pages-6f42c1.svg)](https://somneelsaha2042.github.io/AgentDocs/)

**Prevent coding agents from using stale, wrong-version, or incomplete documentation.**

AgentDocs is a local context compiler and CI gate. It turns existing Markdown,
MDX, and public documentation websites into task-specific, source-linked
evidence for coding agents.

Agents fail when they reuse stale docs, mix versions or frameworks, or start a
task without source-backed evidence. AgentDocs answers four operational
questions before an agent relies on the docs:

- Is the compiled context fresh?
- Is it scoped to the right version, framework, router, runtime, or locale?
- Does it contain evidence for the task I am about to ask an agent to do?
- Did it compile the intended docs corpus, or only a tiny supported slice?

The output includes compact task packs, searchable artifacts, readiness
findings, handoff bundles, freshness state, and read-only MCP tools. It does not
require an LLM, execute commands found in documentation, or mutate source docs.

Use AgentDocs when:

- you maintain docs and want an agent-readiness gate;
- you use coding agents and need safer context for third-party dependencies;
- you operate agent infrastructure and want reusable local context through MCP.

> **Usable beta:** AgentDocs is published on npm as
> `@somneelsaha/agentdocs` and can be installed today with Node.js 20 or later.
> The core compile, audit, search, handoff, freshness, and MCP workflows are
> implemented for real-repository testing. The active build plan now focuses on
> v1 product hardening: tighter context selection, generic compiler behavior,
> source contract closure, and publishable proof runs.
>
> It is still beta software: OpenAPI ingestion is deferred and rejected early, and large or
> unusual docs sites may need scoped crawl settings. Local and repo ingestion
> compiles Markdown/MDX, Sphinx/reST (including Django-style `.txt` files), and
> AsciiDoc/Antora formats, with deterministic transclusion and skip telemetry.
> The core compile, audit, search, handoff, freshness, and MCP workflows are usable.

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

## Choose A Workflow

| I want to... | Start with | Success signal |
| --- | --- | --- |
| Maintain documentation | `agentdocs build && agentdocs doctor` | CI can fail on stale, incomplete, or unsafe context. |
| Use a coding agent on an app | `agentdocs try <url-or-path> --goal "<task>"` | The agent receives a task handoff with source evidence. |
| Operate agent infrastructure | `agentdocs serve-mcp` | Agents can read task packs and verified context from local artifacts. |

## Five-Minute Walkthrough

For a one-command trial, run:

```bash
agentdocs try ./docs --goal "implement authentication"
```

This collects the docs, builds and audits the context layer, checks whether the
goal has evidence, and prints the exact MCP command and coding-agent prompt to
use next. For large multi-product sites, AgentDocs infers the nearest
product/version guide scope instead of attempting to mirror the entire
documentation domain.

Reuse the built context without crawling again:

```bash
agentdocs status
agentdocs handoff "implement authentication"
agentdocs setup-agent --client codex
agentdocs serve-mcp
agentdocs verify-context --task "implement authentication"
```

`handoff` is the recommended multi-session command. It wraps the compact
`context` bundle with freshness, selected task pack, source pages, gotchas,
setup commands, and MCP tool/resource suggestions, so an agent can start from
current, scoped, evidence-backed context instead of raw search results. The
older `agentdocs context "<goal>"` command remains available for the smaller
bundle. Human output for the workflow highlights read-first resources, selected
task evidence, freshness, warnings, and the exact MCP command to launch.

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

Keep version, framework, router, runtime, or locale-specific results inside an
explicit context boundary:

```bash
agentdocs search "migration" --facet version=v5
agentdocs search "query invalidation" --facet framework=react
agentdocs search "quickstart" --facet locale=en
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

The generated output is designed for operational checks and task execution, not
document browsing:

- `llms.txt` provides a concise entry point.
- Generated `AGENTS.md` captures setup, concepts, tasks, and common mistakes.
- `agent-brief.md` is the first persistent file to show a coding agent.
- Task packs bundle evidence-backed instructions for detected task families.
- `agent-map.json` exposes pages, chunks, entities, edges, context facets, and evidence.
- `manifest.json` records build counts and source coverage for local/repo sources.
- `index.sqlite` provides ranked offline search.
- `state/build-state.json` powers freshness checks and changed-source rebuilds.
- The readiness report identifies actionable gaps and caps scores when critical
  task context conflicts or source coverage failures remain.

Refresh generated state from scratch when you intentionally want to discard old
context:

```bash
agentdocs build --clean
```

Publish or archive built context after review:

```bash
agentdocs export --format static --to ./dist-agentdocs
agentdocs export --format llms --to ./public --force
```

`static` exports the full `.agentdocs/` output. `llms` exports the publishable
agent-facing subset: `llms.txt`, generated `AGENTS.md`, `agent-brief.md`, the
manifest, agent map, chunks, task packs, and readiness reports when present.

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

Use readiness scoring and freshness checks as local or CI quality gates:

```bash
agentdocs status --json
agentdocs verify-context --task "build Fastify v5 route" --facet version=v5 --json
agentdocs build --check
agentdocs doctor --min-score 80
agentdocs doctor --json
```

`build --check` is non-mutating. It fails when the built context is missing,
stale, or has changed source/artifact fingerprints, and supports `--json` for
CI systems.

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
filesystem paths. When `serve-mcp --tools` is used to restrict exposed tools,
the allowlist is enforced both when listing tools and when a client attempts to
call a hidden tool.

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

For local and repo sources, AgentDocs also measures source coverage before it
claims confidence. Supported `.md`, `.mdx`, Sphinx/reST (`.rst`, `.txt`), and
AsciiDoc (`.adoc`, `.asciidoc`) files are compiled, resolving transclusions
(includes) up to a bounded depth of 8. Any out-of-scope, missing, or cyclic
includes are reported as transclusion gaps, and pages with insufficient content
are skipped with precise reasons.

The workflow layer follows the same rule. Freshness is computed from local
source hashes, website TTLs, config hashes, and build-owned artifact hashes.
Context verification is deterministic: it checks stale artifacts, mixed
exclusive facets, deprecated evidence, weak task packs, missing canonical
sources, and requested facet mismatches. Search also uses deterministic
content-type and locale facets so implementation tasks prefer docs, tutorials,
and reference material over blog, news, and release pages when implementation
evidence exists. No LLM decides whether context is safe.

Two tradeoffs are deliberate:

- Website freshness uses a TTL instead of live network revalidation so
  `agentdocs status` stays local and predictable.
- `setup-agent` prints copy-paste snippets instead of silently editing client
  config files, because agent clients change formats and developers should stay
  in control of their editor/assistant settings.
- `build --check` reads build state rather than rebuilding into place. CI should
  detect drift without changing the workspace it is judging.
- `build --clean` and removed-source pruning are constrained to generated
  AgentDocs output paths. Source documentation is never silently rewritten or
  deleted.
- `export --format llms` separates publishable agent context from raw collected
  source snapshots. Teams can publish reviewed context without exposing every
  local crawl artifact.

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
- full prepared-target dogfood reruns with preserved historical metrics;
- schema validation for generated JSON and JSONL artifacts;
- repeated-build artifact hash checks;
- SQLite/FTS5 search on Node 22 and deterministic lexical fallback on Node 20;
- Linux Node 20/22 and Windows Node 20 CI;
- npm tarball contents and clean global-install verification;
- real CLI workflow and MCP stdio smoke tests;
- path traversal, invalid artifacts, broken links, and untrusted-input behavior.

Latest dogfood metrics are published in the
[Phase 5 full dogfood rerun](https://somneelsaha2042.github.io/AgentDocs/results/full-dogfood-rerun-phase-5).

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
    locale: en
  exclusiveKeys: [version, framework, router, runtime, locale]
  rules:
    - match: "**/blog/**"
      facets:
        content_type: blog

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

- OpenAPI ingestion is deferred to a future opt-in adapter; this build rejects configured OpenAPI sources and direct OpenAPI file ingestion early with a clear message.
- Inspect currently covers entities, links, and task-pack explanations.
- Broken-link checks validate generated heading fragments for collected pages;
  custom framework anchors may still require review.
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
