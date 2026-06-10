# AgentDocs

AgentDocs is a deterministic, local-first compiler and auditor for agent-readable technical documentation.

This repository is currently at Phase 3: local Markdown/MDX ingestion and same-origin website crawling produce schema-valid normalized pages and source manifests. Artifact generation, search, and MCP behavior are intentionally not implemented yet.

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
