# Quick Start

<img class="doc-illustration" src="/brand/feature-build.png" alt="Compile documentation into structured outputs" />

Try AgentDocs on a public docs URL or local Markdown path with one command:

```bash
agentdocs try https://docs.example.com --goal "implement authentication"
```

AgentDocs crawls or ingests the source, builds artifacts, runs the readiness
audit, finds goal-relevant evidence, and prints the MCP command and prompt to
use next.

AgentDocs scopes large sites to the nearest product/version guide. Override the
inferred scope when needed:

```bash
agentdocs try https://docs.example.com/product/latest/start \
  --goal "configure authentication" \
  --include "/product/latest/**" \
  --max-pages 100
```

Reuse the built artifacts without crawling again:

```bash
agentdocs context "configure authentication"
```

## Maintained Configuration

From the project whose documentation you want AgentDocs to compile:

```bash
agentdocs init
```

The generated configuration points at `./docs` by default. Review it, then run:

```bash
agentdocs build
agentdocs doctor
agentdocs search "authentication"
```

Inspect the most useful generated files:

```txt
.agentdocs/llms.txt
.agentdocs/AGENTS.md
.agentdocs/task-packs/
.agentdocs/reports/agent-readiness.md
```

## Crawl Public Documentation

```bash
agentdocs crawl https://docs.example.com
agentdocs build --skip-crawl
agentdocs doctor
```

The crawler stays on the configured origin by default. AgentDocs parses code
and commands as untrusted text and never executes them. It records inferred
scope, sitemap discovery, request counts, failures, and Markdown alternatives
in `.agentdocs/sources/crawl-manifest.json`.
