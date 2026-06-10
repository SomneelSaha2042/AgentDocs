# Build Plan: AgentDocs

This document defines the phase-by-phase implementation plan for AgentDocs, with gates that must pass before moving to the next phase.

The project should be built in small, reviewable increments. Each phase should produce working software, tests, and documentation updates.

## 0. Execution model

Use Codex to implement one phase at a time.

For each phase:

1. Read `PRD.md`, `AGENTS.md`, `APIS_AND_DOCUMENTATION.md`, and this file.
2. Implement only the current phase scope.
3. Add tests and fixtures.
4. Run the required checks.
5. Produce a short implementation note listing what changed, how it was tested, and known limitations.
6. Do not proceed to the next phase until the gate passes.

Core invariant:

> AgentDocs must remain useful without any LLM dependency.

## Phase 0: Repository scaffold

### Goal

Create a clean TypeScript project foundation that can support the CLI, core packages, tests, fixtures, and generated artifacts.

### Scope

Implement:

```txt
package.json
pnpm-workspace.yaml
tsconfig.base.json
.gitignore
README.md placeholder
PRD.md
AGENTS.md
APIS_AND_DOCUMENTATION.md
BUILD_PLAN.md
packages/shared
packages/cli
fixtures/basic-docs
```

### Requirements

- Use TypeScript strict mode.
- Use pnpm workspaces.
- Add test runner.
- Add basic `typecheck`, `test`, and `build` scripts.
- Create a minimal CLI that responds to `agentdocs --help`.

### Gate 0

Passes when:

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm --filter agentdocs exec agentdocs --help
```

Expected result:

- all commands succeed;
- help text lists placeholder commands;
- no crawler/indexer/generator functionality required yet.

## Phase 1: Config system and CLI skeleton

### Goal

Implement the config file format and command skeletons.

### Scope

Implement:

```txt
agentdocs init
agentdocs build --help
agentdocs crawl --help
agentdocs ingest --help
agentdocs doctor --help
agentdocs search --help
agentdocs inspect --help
agentdocs export --help
agentdocs serve-mcp --help
```

Implement config schema in `packages/shared`.

### Requirements

- `agentdocs init` writes `agentdocs.config.yaml`.
- Existing config is not overwritten unless `--force` is passed.
- Config parser supports YAML.
- Invalid config errors are actionable.
- Global options are parsed.

### Gate 1

Passes when:

```bash
pnpm test
pnpm typecheck
agentdocs init --out .agentdocs-test
agentdocs init --force
```

Acceptance tests:

- generated config validates;
- invalid config fails with exit code 2;
- command help matches `APIS_AND_DOCUMENTATION.md`.

## Phase 2: Local markdown ingestion

### Goal

Support deterministic ingestion of local markdown and MDX files.

### Scope

Implement:

```txt
agentdocs ingest ./docs
```

For `.md` and `.mdx` files:

- read content;
- parse frontmatter;
- extract title;
- extract headings;
- extract links;
- extract fenced code blocks;
- produce normalized `DocPage` objects;
- write normalized pages to `.agentdocs/sources/pages`;
- write ingest manifest.

### Requirements

- Preserve relative paths.
- Generate stable page IDs.
- Support nested directories.
- Do not execute code blocks.
- Use fixtures for coverage.

### Gate 2

Passes when:

```bash
pnpm test
pnpm typecheck
agentdocs ingest fixtures/basic-docs --out .agentdocs-test
```

Acceptance:

- normalized pages are generated;
- headings, links, and code blocks are extracted;
- generated JSON validates against schemas;
- snapshots are deterministic across runs.

## Phase 3: Website crawling MVP

### Goal

Support basic crawling for public docs sites.

### Scope

Implement:

```txt
agentdocs crawl <url>
```

Crawler strategy:

1. Attempt sitemap discovery.
2. Crawl sitemap URLs matching include/exclude rules.
3. If sitemap is unavailable, crawl same-origin links from the start URL.
4. Convert HTML pages to normalized `DocPage` objects.

### Requirements

- Same-origin by default.
- Configurable include/exclude globs.
- Max page limit.
- Request timeout.
- Canonical URL normalization.
- Duplicate URL handling.
- Store raw HTML and normalized markdown.
- Avoid crawling assets, images, PDFs, and non-HTML in MVP.

### Gate 3

Passes when:

```bash
pnpm test
pnpm typecheck
agentdocs crawl <local-fixture-server-url> --out .agentdocs-test
```

Acceptance:

- test crawler works against a local fixture server;
- no live network dependency in default tests;
- sitemap and fallback link crawling both have tests;
- include/exclude rules work;
- max page limit works.

## Phase 4: Normalization, chunking, and extraction

### Goal

Turn normalized pages into heading-aware chunks and extract useful deterministic entities from text and code.

### Scope

Implement:

```txt
chunkMarkdownByHeading
extractPackages
extractImports
extractEnvVars
extractCliCommands
extractHttpRoutes
extractDeprecatedMarkers
extractVersionHints
extractWarnings
```

### Requirements

Chunking:

- preserve heading path;
- keep chunks under configurable approximate token size;
- keep code blocks attached to relevant heading when possible.

Extraction:

- package install commands from npm/yarn/pnpm/bun/pip/cargo/go/etc. where simple;
- JS/TS imports;
- environment variables such as `ACME_API_KEY`;
- HTTP routes such as `GET /v1/users`;
- deprecated markers from text and admonitions;
- warning/caution/security/admonition blocks.

### Gate 4

Passes when:

```bash
pnpm test
pnpm typecheck
agentdocs build --skip-crawl --out .agentdocs-test
```

Acceptance:

- chunks are deterministic;
- entities are extracted from fixtures;
- no extracted command is executed;
- content hashes are stable;
- generated `chunks.jsonl` validates.

## Phase 5: Graph and agent map

### Goal

Build a deterministic page/entity graph and emit `agent-map.json`.

### Scope

Implement:

- page nodes;
- chunk references;
- entity nodes;
- link edges;
- entity evidence;
- simple relationship edges:
  - `links_to`;
  - `defines`;
  - `uses`;
  - `requires`;
  - `versioned_as`;
  - `example_for` where deterministic evidence exists.

### Requirements

- Graph uses stable IDs.
- Edges include evidence.
- Confidence values are deterministic.
- Output validates against schema.
- Graph ordering is deterministic.

### Gate 5

Passes when:

```bash
pnpm test
pnpm typecheck
agentdocs build --skip-crawl --out .agentdocs-test
agentdocs inspect entities --out .agentdocs-test
agentdocs inspect links --out .agentdocs-test
```

Acceptance:

- `agent-map.json` is generated;
- entities and edges match snapshots;
- source evidence exists for all entities and edges;
- no invented concepts appear without evidence.

## Phase 6: Static artifact generation

### Goal

Generate the first agent-facing artifacts: `llms.txt`, generated `AGENTS.md`, and task packs.

### Scope

Implement generators for:

```txt
llms.txt
AGENTS.md
.agentdocs/task-packs/*.md
.agentdocs/manifest.json
```

Task pack generation should be deterministic.

Initial task families:

```txt
quickstart
installation
authentication
configuration
webhooks
pagination
errors
migration
deployment
```

Task pack selection heuristics:

- title/heading/URL keyword match;
- code block evidence;
- warning/deprecated evidence;
- OpenAPI path/operation evidence where available;
- link graph proximity.

### Requirements

- Generated artifacts must be compact.
- Task packs must include evidence links.
- If evidence is weak, mark confidence as low.
- Do not claim unsupported implementation steps.
- Do not include giant raw docs dumps.

### Gate 6

Passes when:

```bash
pnpm test
pnpm typecheck
agentdocs build --skip-crawl --out .agentdocs-test
```

Acceptance:

- `llms.txt` generated;
- generated `AGENTS.md` generated;
- at least one task pack generated from fixture docs;
- task pack includes required context, steps, gotchas, and source evidence;
- snapshots are deterministic.

## Phase 7: Doctor/readiness report

### Goal

Build the agent-readiness scanner.

### Scope

Implement:

```bash
agentdocs doctor
agentdocs doctor --min-score 75
agentdocs doctor --json
```

Categories:

```txt
discoverability
structure
task_coverage
version_safety
agent_safety
runtime_readiness
```

Initial checks:

```txt
has_config
has_pages
has_titles
has_headings
has_code_blocks
has_installation_evidence
has_quickstart_candidate
has_auth_candidate
has_task_packs
has_llms_txt
has_agents_md
has_agent_map
has_broken_internal_links
has_giant_pages
has_deprecated_markers
has_version_hints
has_security_warnings
has_env_var_examples
```

### Requirements

- Score is deterministic.
- Report is actionable.
- JSON and markdown outputs are generated.
- `--min-score` controls exit code 5.
- Broken links are detected for internal pages.

### Gate 7

Passes when:

```bash
pnpm test
pnpm typecheck
agentdocs doctor --out .agentdocs-test
agentdocs doctor --out .agentdocs-test --min-score 100
```

Acceptance:

- report generated;
- score explained;
- failing threshold exits with code 5;
- at least one fixture produces warnings/failures;
- recommendations are actionable and evidence-linked.

## Phase 8: SQLite search index

### Goal

Enable offline search over generated docs and chunks.

### Scope

Implement:

```bash
agentdocs search <query>
```

Build:

```txt
.agentdocs/index.sqlite
```

Use SQLite FTS5 if available. If FTS5 support is hard in the selected runtime, provide a deterministic fallback lexical search and document the limitation.

### Requirements

- Search titles, headings, and chunks.
- Return ranked results.
- Include snippets and source URLs/paths.
- Support `--json`.
- Search works without network.

### Gate 8

Passes when:

```bash
pnpm test
pnpm typecheck
agentdocs search "authentication" --out .agentdocs-test
agentdocs search "webhook" --out .agentdocs-test --json
```

Acceptance:

- relevant fixture results rank above irrelevant ones;
- output includes page/chunk IDs;
- offline search succeeds after build;
- tests cover empty/no-result queries.

## Phase 9: MCP server MVP

### Goal

Expose built artifacts to coding agents through a local MCP server.

### Scope

Implement:

```bash
agentdocs serve-mcp
```

Tools:

```txt
search_docs
get_page
get_task_pack
get_agent_start_context
get_code_examples
get_related_pages
```

Resources:

```txt
agentdocs://llms.txt
agentdocs://AGENTS.md
agentdocs://manifest.json
agentdocs://agent-map.json
agentdocs://task-packs/{task}.md
agentdocs://pages/{pageId}.md
```

### Requirements

- stdio transport for local clients;
- read-only access to `.agentdocs` artifacts;
- no crawling from MCP;
- no arbitrary filesystem read;
- no code execution;
- structured errors for missing artifacts.

### Gate 9

Passes when:

```bash
pnpm test
pnpm typecheck
agentdocs serve-mcp --out .agentdocs-test
```

Acceptance:

- MCP server starts;
- tools return fixture data;
- resources can be read;
- missing task/page returns structured error;
- security tests confirm no path traversal.

## Phase 10: OpenAPI ingestion

### Goal

Add deterministic OpenAPI ingestion and connect operations to task packs and graph entities.

### Scope

Implement:

```bash
agentdocs ingest ./openapi.yaml
```

Extract:

- operation IDs;
- methods and paths;
- tags;
- summaries/descriptions;
- auth schemes;
- request/response schemas by reference;
- deprecation flags;
- server URLs.

### Requirements

- Support OpenAPI 3.x JSON and YAML.
- Emit pages/entities for endpoints.
- Add edges from docs pages to API operations where routes match.
- Improve task packs when OpenAPI evidence exists.

### Gate 10

Passes when:

```bash
pnpm test
pnpm typecheck
agentdocs ingest fixtures/openapi/openapi.yaml --out .agentdocs-test
agentdocs build --skip-crawl --out .agentdocs-test
```

Acceptance:

- API entities appear in `agent-map.json`;
- deprecated OpenAPI operations affect readiness report;
- route search returns API operations;
- task packs can list relevant endpoints.

## Phase 11: Dogfooding and real-world hardening

### Goal

Use AgentDocs on real docs projects and fix practical gaps.

### Scope

Run against at least:

```txt
one local markdown docs folder
one Docusaurus-like docs site
one API-reference-heavy docs site
one SDK docs site with code examples
this repository's own docs
```

### Requirements

- Document failures.
- Add fixtures for fixed bugs.
- Improve error messages.
- Update README with a real walkthrough.

### Gate 11

Passes when:

- README has a working quickstart;
- at least three real-world docs runs are documented;
- top five failure modes have either fixes or explicit known limitations;
- dogfood output is good enough to use with Codex or another coding agent.

## Phase 12: CI integration

### Goal

Make AgentDocs useful for maintainers in CI.

### Scope

Implement:

```bash
agentdocs doctor --min-score 75
agentdocs build --check
```

Potential GitHub Action documentation:

```yaml
name: AgentDocs
on: [pull_request]
jobs:
  agentdocs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install
      - run: pnpm agentdocs build --check
      - run: pnpm agentdocs doctor --min-score 75
```

### Gate 12

Passes when:

- CI commands work locally;
- generated artifacts can be checked for drift;
- doctor threshold can fail a build;
- docs explain how maintainers should adopt it.

## Phase 13: Optional LLM enrichment boundary

### Goal

Design, but do not require, optional LLM enrichment.

### Scope

Add architecture only if core MVP is stable.

Potential command:

```bash
agentdocs enrich --provider openai
agentdocs enrich --provider anthropic
agentdocs enrich --provider ollama
```

Allowed uses:

- concept summaries;
- task-pack wording improvement;
- page importance scoring;
- duplicate page detection suggestions;
- docs issue suggestions.

Rules:

- optional only;
- off by default;
- no generated claim without evidence;
- never required for tests or basic build;
- all LLM outputs must be marked as generated suggestions.

### Gate 13

Passes when:

- core pipeline still works offline;
- enrichment can be disabled completely;
- generated suggestions include evidence;
- tests can run without API keys.

## Recommended first Codex prompt

Use this prompt to start implementation:

```txt
Read PRD.md, AGENTS.md, APIS_AND_DOCUMENTATION.md, and BUILD_PLAN.md. Implement Phase 0 only. Create the TypeScript/pnpm monorepo scaffold, minimal CLI help, shared package placeholder, basic fixtures, and test/typecheck/build scripts. Do not implement crawler, indexing, MCP, or artifact generation yet. After implementation, run the Phase 0 gate commands and summarize results, changed files, and known limitations.
```

## Product quality bar

A phase is not complete just because code exists. It must preserve the product essence:

- deterministic;
- evidence-linked;
- local-first;
- no mandatory AI dependency;
- useful to a coding agent;
- useful to a maintainer trying to improve docs.

## MVP release criteria

The first public MVP can be released when Phases 0 through 9 pass.

Minimum release command path:

```bash
agentdocs init
agentdocs crawl https://docs.example.com
agentdocs build
agentdocs doctor
agentdocs search "authentication"
agentdocs serve-mcp
```

Minimum release artifacts:

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

Minimum release guarantees:

- no required LLM dependency;
- no account required;
- deterministic output from fixtures;
- all JSON artifacts schema-valid;
- MCP server is read-only;
- documented known limitations.
