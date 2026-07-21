# APIs and Documentation

This document defines the public CLI, configuration, generated artifacts, internal data contracts, and MCP surface for AgentDocs.

The contracts here are intentionally explicit so Codex and contributors can build the system phase by phase without drifting from the product intent.

## 1. Public CLI

Executable name:

```bash
agentdocs
```

Global options:

```txt
--config <path>       Path to agentdocs config. Default: ./agentdocs.config.yaml
--out <path>          Output directory. Default: ./.agentdocs
--cwd <path>          Working directory. Default: process.cwd()
--json                Emit JSON where supported
--verbose             Print detailed progress
--quiet               Suppress non-error logs
--no-color            Disable colored output
```

Stable exit codes:

| Code | Meaning |
|---:|---|
| 0 | success |
| 1 | general failure |
| 2 | invalid user input/config |
| 3 | crawl/ingest failure |
| 4 | schema validation failure |
| 5 | readiness threshold failure |
| 6 | MCP server startup failure |

## 2. CLI commands

### 2.0 `agentdocs try <url-or-path>`

Runs the beginner/dependency-user workflow in one command.

```bash
agentdocs try https://docs.example.com --goal "implement authentication"
agentdocs try ./docs --goal "debug webhook verification" --json
agentdocs try https://docs.example.com/guide --goal "configure auth" --include "/guide/**" --max-pages 100
```

Behavior:

- crawls an HTTP(S) source or ingests a local Markdown path;
- builds artifacts and the search index;
- runs the readiness audit;
- searches for evidence relevant to `--goal`;
- prints the best context paths, MCP command, and coding-agent prompt.
- infers a product/version guide scope for website sources unless `--include`
  is supplied;
- records crawl scope, discovery, request counts, failures, and Markdown
  alternatives.

### 2.0.1 `agentdocs context <goal>`

Produces a compact context bundle from existing built artifacts without
collecting sources again.

```bash
agentdocs context "implement authentication"
agentdocs context "debug webhook verification" --json
```

The bundle includes the strongest matching task pack when available, rules,
supporting resources, and a dynamic goal bundle composed from up to five
complementary evidence sections. Fixed task packs are included only when they
materially match the goal.

### 2.0.2 `agentdocs handoff <goal>`

Produces the recommended multi-session task handoff from existing artifacts.

```bash
agentdocs handoff "implement webhook verification"
agentdocs handoff "build Fastify v5 route" --json
```

The handoff includes the compact context bundle, selected task pack, top source
pages, gotchas, setup commands, freshness status, MCP tool/resource suggestions,
and context warnings. `agentdocs context` remains supported for the earlier
compact bundle shape.

### 2.0.3 `agentdocs setup-agent`

Prints copy-paste MCP setup snippets for common coding-agent clients.

```bash
agentdocs setup-agent
agentdocs setup-agent --client codex
agentdocs setup-agent --client claude --json
```

Supported clients are `codex`, `claude`, `cursor`, and `generic`.
Generated setup snippets expose the compact `query_docs,read_page` MCP tool
profile. Users can run `serve-mcp` without `--tools` when they need the full
read-only tool surface.

### 2.0.4 `agentdocs status`

Checks whether the built context layer is fresh.

```bash
agentdocs status
agentdocs status --json
```

Local and repository sources are compared by deterministic content hash.
Website sources are fresh until their configured TTL expires. Missing
`state/build-state.json` reports `unknown`.

### 2.0.5 `agentdocs rebuild --changed`

Recollects stale configured sources and runs the normal build pipeline.

```bash
agentdocs rebuild --changed
```

The command requires `agentdocs.config.yaml`. It does not mutate source docs and
does not use an LLM.

### 2.0.6 `agentdocs watch`

Polls `agentdocs status` and rebuilds when context is stale.

```bash
agentdocs watch
agentdocs watch --interval-ms 5000
agentdocs watch --once
```

`--once` performs a single check, useful for smoke tests and scripts.

### 2.0.7 `agentdocs verify-context`

Checks whether task context is safe to use.

```bash
agentdocs verify-context --task "build Fastify v5 route"
agentdocs verify-context --task "build Fastify v5 route" --facet version=v5 --json
```

Verification reports `pass`, `warn`, or `fail` for stale artifacts, mixed
exclusive facets, deprecated evidence, weak or missing task-pack evidence,
missing canonical sources, and preferred-context mismatches.

### 2.1 `agentdocs init`

Creates a starter config.

```bash
agentdocs init
agentdocs init --force
```

Behavior:

- writes `agentdocs.config.yaml`;
- does not overwrite existing config unless `--force` is passed;
- includes commented examples.

Acceptance:

- generated config validates;
- user can run `agentdocs build` after filling in a source.

### 2.2 `agentdocs crawl <url>`

Crawls a docs website and stores source snapshots plus normalized pages.

```bash
agentdocs crawl https://docs.example.com
agentdocs crawl https://docs.example.com --max-pages 500
agentdocs crawl https://docs.example.com --include "/docs/**" --exclude "/blog/**"
```

Options:

```txt
--max-pages <n>       Maximum pages to crawl
--include <glob>      Include URL/path glob; repeatable
--exclude <glob>      Exclude URL/path glob; repeatable
--respect-robots      Respect robots.txt where supported
--sitemap <url>       Explicit sitemap URL
--user-agent <value>  Custom user agent
--timeout-ms <n>      Request timeout
```

Behavior:

- fetches and resolves the starting page first;
- allows the user-supplied start URL to resolve across origins, then adopts the
  final origin as the strict crawl boundary;
- infers a guide/product/version path scope unless `--include` is supplied;
- discovers sitemaps from `--sitemap`, `robots.txt`, then `/sitemap.xml`;
- bounds sitemap discovery to a deterministic fraction of the page-request
  budget, up to 50 requests;
- supplements sitemap discovery with scoped page links;
- continues through individual page failures while useful pages are found;
- when `--max-pages` is supplied without an explicit request budget, attempts
  at most three page fetches per requested useful page, up to 300;
- prefers official same-origin Markdown alternatives when available;
- normalizes common locale selectors such as `hl` and `locale` so one crawl
  does not collect the same guide in multiple languages;
- rejects empty and heading-only extraction as unusable while preserving raw
  snapshots and diagnostics;
- deduplicates normalized pages by canonical URL and content hash.

Outputs:

```txt
.agentdocs/sources/pages/*.raw.html
.agentdocs/sources/pages/*.md
.agentdocs/sources/crawl-manifest.json
```

The crawl manifest records scope, discovery method, sitemap URLs, request and
page counts, useful and unusable extraction counts, discovery-budget warnings,
duplicate-content skips, deterministic failure reasons, and per-page
normalization source. A crawl that yields no useful normalized pages exits with
code `3` after writing diagnostics.

### 2.3 `agentdocs ingest <path>`

Ingests a local docs folder or file.

```bash
agentdocs ingest ./docs
agentdocs ingest ./README.md
agentdocs ingest ./docs --strict
agentdocs ingest ./docs --source-manifest ./docs.provenance.json
```

Supported inputs:

```txt
.md
.mdx
.rst
.txt, when detected as reST-like docs
.adoc
.asciidoc
```

Local and repo ingestion also records source coverage for docs-like files in
the configured scope. The ingest manifest reports compiled, degraded, skipped,
failed, supported, unsupported, and coverage-ratio counts so a tiny supported
slice in a larger docs corpus is not treated as full coverage.

MDX ingestion is tolerant by default. Strict parsing is attempted first. On
failure, AgentDocs removes imports/exports and replaces JSX tags and brace
expressions outside fenced code with explicit omission markers, then records
file-level diagnostics. `--strict` disables this fallback.

For captured/offline documentation, `--source-manifest <path>` accepts a local
JSON provenance sidecar. Each listed file must include its source URL and
SHA-256; AgentDocs verifies the hash before normalization, attaches the URL to
the generated page, and copies the validated sidecar to
`.agentdocs/sources/provenance-manifest.json`. Files without a sidecar record
remain ingestible but receive an explicit provenance warning. No network fetch
is performed to fill missing records.

OpenAPI ingestion is deferred in this build. Configured OpenAPI sources and direct OpenAPI file ingestion attempts fail early with an actionable unsupported-source message instead of producing generic chunks. OpenAPI files encountered inside mixed docs directories are not compiled into context.

### 2.4 `agentdocs build`

Builds normalized docs, graph, index, and generated artifacts.

```bash
agentdocs build
agentdocs build --skip-crawl
agentdocs build --clean
agentdocs build --check
agentdocs build --check --json
```

Behavior:

- reads config and ingested sources;
- prunes output from sources removed from the current config;
- with `--clean`, safely removes the configured output directory before
  collecting and building;
- with `--check`, performs a non-mutating drift check against
  `state/build-state.json` and exits non-zero when context is stale, missing,
  or unknown;
- normalizes pages;
- chunks pages;
- extracts entities;
- builds graph;
- generates files;
- validates artifacts;
- writes index.

Outputs:

```txt
.agentdocs/llms.txt
.agentdocs/AGENTS.md
.agentdocs/agent-brief.md
.agentdocs/manifest.json
.agentdocs/agent-map.json
.agentdocs/chunks.jsonl
.agentdocs/task-packs/*.md
.agentdocs/index.sqlite
.agentdocs/state/build-state.json
```

`build --json` includes `sourceCoverage` when local or repo ingest manifests are
available. Generated `manifest.json` includes the same aggregate coverage
summary.

Local builds keep generated `llms.txt` and `AGENTS.md` inside `--out` so the
source project's existing files are never overwritten silently. A later export
or publishing phase may place reviewed copies at the target project root.

`--clean` refuses to remove the project root, filesystem roots, or paths outside
the configured working directory.

`--check` cannot be combined with `--clean`. It does not collect sources, crawl
websites, prune files, regenerate artifacts, or write build state. Human output
summarizes stale sources, stale/missing artifacts, and next actions. JSON output
is the same status report shape as `agentdocs status --json`.

### 2.5 `agentdocs doctor`

Runs readiness checks.

```bash
agentdocs doctor
agentdocs doctor --min-score 75
agentdocs doctor --json
```

Options:

```txt
--min-score <n>       Fail if score is below threshold
--category <name>     Run one category only
```

Outputs:

```txt
.agentdocs/reports/agent-readiness.md
.agentdocs/reports/agent-readiness.json
```

Readiness fails extraction quality when no useful pages or chunks exist. Scores
are capped when most fetched pages were unusable, and uncollected scoped links
are not reported as broken links.

### 2.6 `agentdocs search <query>`

Searches the local index.

```bash
agentdocs search "webhook signature"
agentdocs search "pagination" --json
agentdocs search "authentication" --limit 5
agentdocs search "migration" --facet version=v5
```

Options:

```txt
--limit <n>           Maximum ranked results to return
--facet <key=value>   Hard context facet filter; repeatable
```

Output fields:

```txt
title
sourceUrl or repoPath
headingPath
snippet
score
pageId
chunkId
facets
warnings
```

### 2.7 `agentdocs inspect <target>`

Inspects generated state.

```bash
agentdocs inspect links
agentdocs inspect entities
agentdocs inspect task-pack <id>
```

`task-pack <id>` explains why a generated task pack exists using its validated
confidence, required pages, steps, related entities, and source evidence.
Current inspect targets cover generated entities, links, and task-pack
explanations. New inspect targets should be added only when they expose product
debugging value that is not already visible through existing workflow commands.

### 2.8 `agentdocs export`

Exports artifacts to a destination.

```bash
agentdocs export --format static --to ./dist-agentdocs
agentdocs export --format llms --to ./public
agentdocs export --format llms --to ./public --force
```

Options:

```txt
--format <format>    Export format: static or llms
--to <path>          Destination directory
--force              Replace a non-empty destination
```

`static` copies the complete built output directory. `llms` copies only the
publishable agent-facing subset: `llms.txt`, generated `AGENTS.md`,
`agent-brief.md`, `manifest.json`, `agent-map.json`, `chunks.jsonl`,
`task-packs/`, and `reports/` when present. Export refuses destinations inside
the active output directory or equal to it.

### 2.9 `agentdocs serve-mcp`

Starts a local MCP server over stdio.

```bash
agentdocs serve-mcp
agentdocs serve-mcp --out .agentdocs
agentdocs serve-mcp --tools query_docs,read_page,verify_task_context
```

Behavior:

- reads generated artifacts;
- exposes tools/resources;
- when `--tools` is supplied, exposes and permits only those tool names;
- does not crawl;
- does not write unless a future explicit tool supports it;
- does not execute commands from docs.

The current v1 path implements the required MCP JSON-RPC surface directly over stdio. Tool
errors return structured `code` and `message` fields. Resource and tool
arguments are validated and cannot be used as arbitrary filesystem paths.
Disallowed allowlisted tool calls return a structured `TOOL_NOT_ALLOWED` tool
error before artifact access.

## 3. Configuration file

Default filename:

```txt
agentdocs.config.yaml
```

Example:

```yaml
name: AgentDocs Example
slug: agentdocs-example
version: v0

sources:
  - type: website
    url: https://docs.example.com
    include:
      - /docs/**
      - /api/**
    exclude:
      - /blog/**
      - /changelog/old/**
    facets:
      runtime: node

  - type: local_markdown
    path: ./docs
    sourceManifest: ./docs.provenance.json
    include:
      - "**/*.md"
      - "**/*.mdx"
    exclude:
      - "**/drafts/**"

  # OpenAPI ingestion is planned as a future opt-in adapter. This build rejects
  # OpenAPI sources early instead of compiling schemas into generic context.

output:
  dir: .agentdocs
  writeLlmsTxt: true
  writeAgentsMd: true
  writeTaskPacks: true
  writeMcpManifest: true

agent:
  preferredLanguage: typescript
  preferredPackageManager: pnpm
  rules:
    - Do not use deprecated APIs.
    - Prefer current SDK examples.

context:
  preferred:
    version: v5
    framework: react
    locale: en
  exclusiveKeys: [version, framework, router, runtime, locale]
  rules:
    - match: "**/react/**"
      facets:
        framework: react
    - match: "**/blog/**"
      facets:
        content_type: blog

normalization:
  mdx: tolerant

freshness:
  websiteTtlHours: 24

doctor:
  minScore: 70
  failOnBrokenLinks: false
  failOnMissingTaskPacks: false
```

## 4. Core data contracts

All schema examples use TypeScript-like notation. Implement with Zod or equivalent runtime validation.

### 4.1 Source

```ts
type Source =
  | WebsiteSource
  | LocalMarkdownSource
  | OpenApiSource
  | RepoSource;

type WebsiteSource = {
  type: "website";
  url: string;
  include?: string[];
  exclude?: string[];
  sitemap?: string;
};

type LocalMarkdownSource = {
  type: "local_markdown";
  path: string;
  include?: string[];
  exclude?: string[];
};

type OpenApiSource = {
  type: "openapi";
  path: string;
};

type RepoSource = {
  type: "repo";
  path: string;
  include?: string[];
  exclude?: string[];
};
```

`OpenApiSource` is reserved for a future opt-in adapter. This build rejects OpenAPI sources during config validation or direct source collection with an actionable unsupported-source message.

### 4.1.1 Missing metric reason

```ts
type MissingMetricReason =
  | "unsupported_format"
  | "scale_limited"
  | "scope_mismatch"
  | "retrieval_mismatch"
  | "historical_metric_not_captured"
  | "preparation_blocked";
```

### 4.1.2 Source coverage

```ts
type SourceCoverage = {
  supportedFiles: number;
  unsupportedFiles: number;
  intendedFiles: number;
  compiledFiles: number;
  degradedFiles: number;
  skippedFiles: number;
  failedFiles: number;
  coverageRatio: number;
  supportedByFormat: { markdown: number; mdx: number };
  unsupportedByFormat: {
    rst: number;
    restText: number;
    adoc: number;
    asciidoc: number;
  };
  gapSeverity: "none" | "warn" | "fail";
  gapReason?: MissingMetricReason;
  message: string;
};
```

`coverageRatio` is `compiledFiles / intendedFiles`, where intended files are
supported Markdown/MDX plus unsupported docs-like files in the configured
source scope. Unsupported source-format gaps use `gapReason:
"unsupported_format"`. Older manifests without this metric are upgraded with
`historical_metric_not_captured`.

### 4.2 Page

```ts
type DocPage = {
  id: string;
  sourceType: "website" | "local_markdown" | "openapi" | "repo";
  sourceUrl?: string;
  repoPath?: string;
  canonicalUrl?: string;
  title: string;
  description?: string;
  markdown: string;
  headings: Heading[];
  links: Link[];
  codeBlocks: CodeBlock[];
  frontmatter?: Record<string, unknown>;
  contentHash: string;
  discoveredAt: string;
  versionHints: string[];
  facets: ContextFacet[];
};
```

### 4.3 Heading

```ts
type Heading = {
  id: string;
  depth: number;
  text: string;
  slug: string;
  position: {
    startLine?: number;
    endLine?: number;
  };
};
```

### 4.4 Link

```ts
type Link = {
  text: string;
  href: string;
  resolvedHref?: string;
  kind: "internal" | "external" | "anchor" | "asset" | "unknown";
  sourceHeadingId?: string;
  isBroken?: boolean;
};
```

### 4.5 Code block

```ts
type CodeBlock = {
  id: string;
  language?: string;
  value: string;
  sourceHeadingId?: string;
  extracted?: {
    packages?: string[];
    imports?: string[];
    envVars?: string[];
    cliCommands?: string[];
    httpRoutes?: string[];
  };
};
```

### 4.6 Chunk

```ts
type Chunk = {
  id: string;
  pageId: string;
  headingPath: string[];
  text: string;
  tokenEstimate: number;
  links: string[];
  entityIds: string[];
  contentHash: string;
  facets: ContextFacet[];
};

type ContextFacet = {
  key: string;
  value: string;
  evidence: Evidence[];
};
```

AgentDocs deterministically extracts these common facet keys when evidence is
available:

```txt
content_type=docs|blog|news|release|reference|tutorial|example
locale=en|en-us|es|fr|...
source_format=markdown|mdx|html
version=...
framework=...
router=...
runtime=...
```

Source `facets` and `context.rules` may set `content_type` and `locale` when
path/title/frontmatter inference is too weak. Search and handoff prefer
`docs`, `tutorial`, and `reference` over `blog`, `news`, and `release` for
implementation goals, while explicit release/news queries can still rank
historical pages. `locale` is an exclusive context key by default.

### 4.7 Entity

```ts
type EntityType =
  | "page"
  | "concept"
  | "api"
  | "function"
  | "class"
  | "package"
  | "cli_command"
  | "config_key"
  | "env_var"
  | "error"
  | "task"
  | "version"
  | "example";

type Entity = {
  id: string;
  type: EntityType;
  name: string;
  aliases: string[];
  sourcePageIds: string[];
  evidence: Evidence[];
};
```

### 4.8 Edge

```ts
type EdgeType =
  | "links_to"
  | "defines"
  | "uses"
  | "requires"
  | "example_for"
  | "error_for"
  | "deprecated_by"
  | "introduced_in"
  | "versioned_as"
  | "related_to";

type Edge = {
  from: string;
  to: string;
  type: EdgeType;
  evidence: Evidence[];
  confidence: number;
};
```

### 4.9 Evidence

```ts
type Evidence = {
  source: "page" | "heading" | "link" | "code_block" | "openapi" | "config";
  pageId?: string;
  headingId?: string;
  codeBlockId?: string;
  url?: string;
  repoPath?: string;
  quote?: string;
};
```

### 4.10 Task pack

```ts
type TaskPack = {
  id: string;
  title: string;
  description: string;
  confidence: "high" | "medium" | "low";
  requiredPages: string[];
  relatedEntities: string[];
  steps: TaskStep[];
  gotchas: Gotcha[];
  codeExamples: Array<string | TaskCodeExample>;
  evidence: Evidence[];
};

type TaskCodeExample = {
  language?: string;
  value: string;
  evidence: Evidence[];
};

type TaskStep = {
  title: string;
  description: string;
  evidence: Evidence[];
};

type Gotcha = {
  text: string;
  severity: "info" | "warning" | "critical";
  evidence: Evidence[];
};
```

## 5. Generated artifact contracts

### 5.1 `manifest.json`

Purpose: build metadata.

```json
{
  "schemaVersion": "0.2.0",
  "project": {
    "name": "Example Docs",
    "slug": "example-docs",
    "version": "v1"
  },
  "generatedAt": "2026-06-09T00:00:00.000Z",
  "sources": [],
  "counts": {
    "pages": 0,
    "chunks": 0,
    "entities": 0,
    "edges": 0,
    "taskPacks": 0
  },
  "sourceCoverage": {
    "supportedFiles": 0,
    "unsupportedFiles": 0,
    "intendedFiles": 0,
    "compiledFiles": 0,
    "degradedFiles": 0,
    "skippedFiles": 0,
    "failedFiles": 0,
    "coverageRatio": 0,
    "supportedByFormat": { "markdown": 0, "mdx": 0 },
    "unsupportedByFormat": {
      "rst": 0,
      "restText": 0,
      "adoc": 0,
      "asciidoc": 0
    },
    "gapSeverity": "none",
    "message": "0 of 0 supported Markdown/MDX file(s) compiled."
  }
}
```

### 5.2 `agent-map.json`

Purpose: machine-readable graph.

```json
{
  "schemaVersion": "0.2.0",
  "pages": [],
  "chunks": [],
  "entities": [],
  "edges": [],
  "taskPacks": []
}
```

### 5.3 `chunks.jsonl`

Each line is a `Chunk` JSON object.

### 5.4 `llms.txt`

Purpose: concise discovery and orientation file for agents.

Required sections:

```md
# Project Name

Short description.

## Start here

## Task packs

## Agent rules

## Source map
```

### 5.5 Generated `AGENTS.md`

Purpose: operational instructions for agents using the target dependency/project.

Required sections:

```md
# Agent instructions for Project Name

## What this project is

## Preferred version and package hints

## Installation and setup

## Main concepts

## Common tasks

## Common mistakes

## Evidence and source docs
```

### 5.6 Task packs

Path:

```txt
.agentdocs/task-packs/{task-id}.md
```

Required sections:

```md
# Task: Webhooks

## When to use this

## Required context

## Steps

## Code examples

## Gotchas

## Source evidence
```

### 5.7 Readiness report

Path:

```txt
.agentdocs/reports/agent-readiness.md
```

Required sections:

```md
# Agent-readiness report

## Score

## Summary

## Critical issues

## Warnings

## Passing checks

## Recommended next actions
```

### 5.8 `agent-brief.md`

Path:

```txt
.agentdocs/agent-brief.md
```

Purpose: persistent first-read brief for coding agents.

Required sections:

```md
# AgentDocs Brief

## Project
## First Steps
## Persistent Agent Prompt
## Preferred Context
## Task Packs
## Version Policy
```

### 5.9 `state/build-state.json`

Purpose: local operational state for freshness checks and changed-source
rebuilds.

```ts
type BuildState = {
  schemaVersion: 1;
  generatedAt: string;
  outputDir: string;
  configHash?: string;
  sources: {
    id: string;
    type: "website" | "local_markdown" | "repo" | "openapi";
    value: string;
    hash: string;
    fileCount?: number;
    collectedAt: string;
    expiresAt?: string;
  }[];
  artifacts: {
    path: string;
    hash: string;
  }[];
};
```

## 6. SQLite index

v1 database file:

```txt
.agentdocs/index.sqlite
```

AgentDocs uses SQLite FTS5 when the active Node.js runtime provides
`node:sqlite` and FTS5. Otherwise, the same path contains a schema-valid,
deterministic lexical fallback index. Both backends support offline search over
titles, headings, and chunks.

Suggested tables:

```sql
CREATE TABLE pages (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_url TEXT,
  repo_path TEXT,
  canonical_url TEXT,
  content_hash TEXT NOT NULL,
  markdown TEXT NOT NULL
);

CREATE VIRTUAL TABLE page_fts USING fts5(
  title,
  markdown,
  content='pages',
  content_rowid='rowid'
);

CREATE TABLE chunks (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL,
  heading_path TEXT NOT NULL,
  text TEXT NOT NULL,
  token_estimate INTEGER NOT NULL,
  content_hash TEXT NOT NULL
);

CREATE VIRTUAL TABLE chunk_fts USING fts5(
  heading_path,
  text,
  content='chunks',
  content_rowid='rowid'
);

CREATE TABLE entities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  aliases_json TEXT NOT NULL,
  evidence_json TEXT NOT NULL
);

CREATE TABLE edges (
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  type TEXT NOT NULL,
  confidence REAL NOT NULL,
  evidence_json TEXT NOT NULL
);
```

## 7. MCP surface

The MCP server reads from generated artifacts and the SQLite index.

### 7.1 Tools

Implemented tools:

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

#### `query_docs`

Preferred first-call interface for implementation goals. It returns compact,
extractive, evidence-linked task context without dumping full pages.

Input:

```json
{
  "goal": "implement pagination with Octokit",
  "task": "Use the current cursor API and preserve the documented next-page token.",
  "facets": {
    "runtime": "node"
  },
  "limit": 5
}
```

Output:

```json
{
  "goal": "implement pagination with Octokit",
  "task": "pagination",
  "answer": "Use the Pagination task context for this goal.",
  "confidence": "medium",
  "steps": [],
  "codeExamples": [],
  "gotchas": [],
  "citations": [],
  "followUpRefs": [],
  "warnings": [],
  "readiness": {
    "recommendation": "inspect",
    "coverage": "partial",
    "issueCodes": ["missing_task_requirement_evidence"],
    "gaps": [
      { "requirement": "next-page token", "status": "partial", "ref": "agentdocs://pages/page_pagination.md#chunk_pagination" }
    ]
  },
  "estimatedTokens": 420
}
```

Every step, code example, gotcha, and citation must have source evidence.
Unsupported steps are omitted rather than invented.
The `task` field may contain detailed constraints or an exact task-pack ID. A
task-pack match is a relevance hint; it never restricts corpus search. The
assembler searches the complete goal/task text and returns a bounded evidence
set. `readiness.recommendation` is `implement` only when selected evidence is
fresh, compatible, and complete for the deterministically extracted task
requirements. Use `inspect` when a source candidate exists but requires audit;
read every `followUpRefs` entry whose `requiredFor` is present. Use `stop` when
an explicit requirement has no source candidate or context is stale or
contradictory. The full requirement evidence is returned by
`verify_task_context` and CLI `verify-context`.

#### `read_page`

Reads a bounded source section by page or chunk ID. `chunkId` may also be a
cited code block ID returned by `query_docs`. By default it returns the matching
chunk/section, not the full normalized page. Full pages are available only when
`fullPage` is explicitly true.

Input:

```json
{
  "pageId": "page_123",
  "chunkId": "chunk_456",
  "heading": "Pagination",
  "maxChars": 4000,
  "fullPage": false
}
```

Output:

```json
{
  "section": {
    "pageId": "page_123",
    "chunkId": "chunk_456",
    "title": "Pagination",
    "headingPath": ["Guides", "Pagination"],
    "text": "...",
    "truncated": false,
    "evidence": []
  }
}
```

#### `search_docs`

Input:

```json
{
  "query": "webhook signature verification",
  "limit": 8,
  "filters": {
    "task": "webhooks",
    "facets": {
      "framework": "react",
      "version": "v5"
    }
  }
}
```

Output:

```json
{
  "results": [
    {
      "pageId": "page_123",
      "chunkId": "chunk_456",
      "title": "Webhook signatures",
      "headingPath": ["Webhooks", "Verify signatures"],
      "snippet": "...",
      "sourceUrl": "https://docs.example.com/webhooks/signatures",
      "score": 12.3
    }
  ]
}
```

#### `get_page`

Input:

```json
{ "pageId": "page_123" }
```

Output:

```json
{
  "page": {
    "id": "page_123",
    "title": "Webhook signatures",
    "markdown": "...",
    "sourceUrl": "..."
  }
}
```

#### `get_task_pack`

Input:

```json
{ "task": "webhooks" }
```

Output:

```json
{
  "taskPack": {
    "id": "webhooks",
    "title": "Webhooks",
    "markdown": "...",
    "confidence": "high"
  }
}
```

#### `get_agent_start_context`

Input:

```json
{ "goal": "implement webhook signature verification" }
```

Output:

```json
{
  "summary": "Use the webhooks task pack first.",
  "readFirst": [
    "agentdocs://task-packs/webhooks.md"
  ],
  "rules": [
    "Verify signatures before processing events."
  ],
  "supportingResources": [
    "agentdocs://pages/page_123.md"
  ]
}
```

#### `list_available_tasks`

Lists generated task packs, confidence, required pages, MCP resources, and
warnings.

#### `get_task_context`

Input:

```json
{
  "goal": "implement webhook signature verification",
  "facets": {
    "version": "v5"
  }
}
```

Output: the same handoff bundle shape as `agentdocs handoff --json`.

#### `verify_task_context`

Input:

```json
{
  "task": "build Fastify v5 route",
  "facets": {
    "version": "v5"
  }
}
```

Output:

```json
{
  "schemaVersion": 1,
  "task": "build Fastify v5 route",
  "status": "pass",
  "summary": "Context is safe to use for this task.",
  "issues": []
}
```

#### `explain_warning`

Explains warning codes such as `context_conflict`, `stale_context`, and
`weak_evidence`.

#### `get_setup_commands`

Returns documented installation/setup commands extracted from source evidence.

#### `get_version_policy`

Returns the configured preferred version when available plus extracted version
evidence.

#### `get_code_examples`

Input:

```json
{
  "query": "create client",
  "language": "typescript",
  "limit": 5
}
```

Output:

```json
{
  "examples": [
    {
      "codeBlockId": "code_123",
      "language": "typescript",
      "value": "...",
      "sourceUrl": "...",
      "headingPath": ["Quickstart", "Create a client"]
    }
  ]
}
```

#### `find_code_examples`

Alias of `get_code_examples`.

#### `get_related_pages`

Input:

```json
{ "pageId": "page_123", "limit": 5 }
```

Output:

```json
{
  "pages": [
    {
      "pageId": "page_456",
      "title": "Webhook events",
      "relationship": "links_to",
      "sourceUrl": "..."
    }
  ]
}
```

### 7.2 Resources

Resource URIs:

```txt
agentdocs://llms.txt
agentdocs://AGENTS.md
agentdocs://manifest.json
agentdocs://agent-map.json
agentdocs://task-packs/{task}.md
agentdocs://pages/{pageId}.md
```

### 7.3 MCP safety constraints

- MCP tools must not execute code.
- MCP tools must not crawl the web.
- MCP tools must not read arbitrary files outside `.agentdocs`.
- MCP tools must not expose secrets from local config.
- MCP tool allowlists must be enforced when tools are called, not only when
  tools are listed.
- MCP tool outputs should include source URLs/paths where possible.

## 8. Readiness checks

Each check returns:

```ts
type ReadinessCheckResult = {
  id: string;
  category: "discoverability" | "structure" | "task_coverage" | "version_safety" | "agent_safety" | "runtime_readiness";
  status: "pass" | "warn" | "fail";
  scoreImpact: number;
  message: string;
  evidence: Evidence[];
  recommendation?: string;
};
```

Initial checks:

```txt
has_config
has_pages
has_sitemap_or_nav
has_source_coverage
has_task_search_scope
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

## 9. Documentation expectations for this repository

The repository should eventually include:

```txt
README.md
PRD.md
AGENTS.md
APIS_AND_DOCUMENTATION.md
BUILD_PLAN.md
CONTRIBUTING.md
examples/README.md
fixtures/README.md
```

The README should be concise and usage-first. The PRD and build plan hold deeper product and execution detail.

## 10. External standards and references

Relevant external concepts:

- `llms.txt`: a convention for giving language models concise site/project context and links to detailed markdown resources.
- MCP: a protocol for exposing resources, prompts, and tools to LLM applications.
- Codex `AGENTS.md`: project-level persistent guidance for Codex.

Do not treat these as complete product definitions. AgentDocs is specifically focused on deterministic generation, readiness diagnostics, task packs, and portable local artifacts.
