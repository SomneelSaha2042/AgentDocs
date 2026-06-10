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

Outputs:

```txt
.agentdocs/sources/pages/*.raw.html
.agentdocs/sources/pages/*.md
.agentdocs/sources/crawl-manifest.json
```

### 2.3 `agentdocs ingest <path>`

Ingests a local docs folder or file.

```bash
agentdocs ingest ./docs
agentdocs ingest ./README.md
agentdocs ingest ./openapi.yaml
```

Supported MVP inputs:

```txt
.md
.mdx
.yaml/.yml OpenAPI
.json OpenAPI
```

### 2.4 `agentdocs build`

Builds normalized docs, graph, index, and generated artifacts.

```bash
agentdocs build
agentdocs build --clean
agentdocs build --skip-crawl
```

Behavior:

- reads config and ingested sources;
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
.agentdocs/manifest.json
.agentdocs/agent-map.json
.agentdocs/chunks.jsonl
.agentdocs/task-packs/*.md
.agentdocs/index.sqlite
```

Local builds keep generated `llms.txt` and `AGENTS.md` inside `--out` so the
source project's existing files are never overwritten silently. A later export
or publishing phase may place reviewed copies at the target project root.

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

### 2.6 `agentdocs search <query>`

Searches the local index.

```bash
agentdocs search "webhook signature"
agentdocs search "pagination" --json
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
```

### 2.7 `agentdocs inspect <target>`

Inspects generated state.

```bash
agentdocs inspect pages
agentdocs inspect links
agentdocs inspect entities
agentdocs inspect chunks
agentdocs inspect task-packs
agentdocs inspect broken-links
agentdocs inspect config
```

### 2.8 `agentdocs export`

Exports artifacts to a destination.

```bash
agentdocs export --format static --to ./dist-agentdocs
agentdocs export --format llms --to ./public
```

### 2.9 `agentdocs serve-mcp`

Starts a local MCP server over stdio.

```bash
agentdocs serve-mcp
agentdocs serve-mcp --out .agentdocs
```

Behavior:

- reads generated artifacts;
- exposes tools/resources;
- does not crawl;
- does not write unless a future explicit tool supports it;
- does not execute commands from docs.

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

  - type: local_markdown
    path: ./docs
    include:
      - "**/*.md"
      - "**/*.mdx"
    exclude:
      - "**/drafts/**"

  - type: openapi
    path: ./openapi.yaml

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
};
```

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
  codeExamples: string[];
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
  "schemaVersion": "0.1.0",
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
  }
}
```

### 5.2 `agent-map.json`

Purpose: machine-readable graph.

```json
{
  "schemaVersion": "0.1.0",
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

## 6. SQLite index

MVP database file:

```txt
.agentdocs/index.sqlite
```

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

#### `search_docs`

Input:

```json
{
  "query": "webhook signature verification",
  "limit": 8,
  "filters": {
    "task": "webhooks"
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
