# AgentDocs

AgentDocs is a deterministic, local-first compiler and auditor for agent-readable technical documentation.

This repository is currently at Phase 7: local Markdown/MDX ingestion and same-origin website crawling produce schema-valid normalized pages and source manifests. Builds produce deterministic chunks, an evidence-linked graph, compact task packs, `llms.txt`, generated `AGENTS.md`, and a build manifest. The doctor command produces deterministic agent-readiness reports. Search and MCP behavior are intentionally not implemented yet.

## Initialize

```bash
pnpm build
pnpm --filter @agentdocs/cli exec agentdocs init
```

This creates a commented, schema-valid `agentdocs.config.yaml`. Existing configs require `--force` before they are overwritten.

## Ingest Local Docs

```bash
pnpm build
pnpm exec agentdocs ingest fixtures/basic-docs --out .agentdocs-test
```

Normalized page JSON and an ingest manifest are written beneath `.agentdocs-test/sources`.

## Crawl A Website

```bash
pnpm exec agentdocs crawl https://docs.example.com --out .agentdocs-test
```

The crawler attempts sitemap discovery first, then falls back to same-origin links. It stores raw HTML, normalized Markdown, validated page JSON, and a crawl manifest.

## Build Graph

```bash
pnpm exec agentdocs build --skip-crawl --out .agentdocs-test
```

The build reads existing normalized pages and writes schema-valid `.agentdocs-test/chunks.jsonl`, `.agentdocs-test/agent-map.json`, `.agentdocs-test/manifest.json`, compact task packs, `.agentdocs-test/llms.txt`, and `.agentdocs-test/AGENTS.md`. Documentation commands are extracted as text and never executed.

Generated `llms.txt` and `AGENTS.md` are kept inside the output directory so AgentDocs never overwrites the source project's instruction files.

## Inspect Graph

```bash
pnpm exec agentdocs inspect entities --out .agentdocs-test
pnpm exec agentdocs inspect links --out .agentdocs-test
```

Entities and relationships include deterministic source evidence.

## Audit Agent Readiness

```bash
pnpm exec agentdocs doctor --out .agentdocs-test
pnpm exec agentdocs doctor --out .agentdocs-test --min-score 75
pnpm exec agentdocs --json doctor --out .agentdocs-test
```

The doctor writes Markdown and schema-valid JSON reports beneath `.agentdocs-test/reports`. It exits with code `5` only when the readiness score is below the configured or requested minimum.

## Development

Requirements:

- Node.js 20 or newer
- pnpm 10

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @agentdocs/cli exec agentdocs --help
```

See [BUILD_PLAN.md](BUILD_PLAN.md) for the phased implementation plan.
