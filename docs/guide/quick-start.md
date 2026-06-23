# Quick Start

<img class="doc-illustration" src="/brand/feature-build.png" alt="AgentDocs mascot compiling loose documentation into an organized stack" />

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
agentdocs status
agentdocs handoff "configure authentication"
agentdocs verify-context --task "configure authentication"
```

Use `context` only when you want the smaller compatibility bundle. `handoff` is
the normal agent workflow because it includes freshness, gotchas, top source
pages, setup commands, and MCP suggestions.

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
agentdocs setup-agent --client codex
```

Use hard context filters when a task requires a specific version, framework,
router, or runtime:

```bash
agentdocs search "migration" --facet version=v5
agentdocs search "query invalidation" --facet framework=react
```

Without a filter, AgentDocs preserves relevant mixed results but emits an
explicit context warning. Configure preferred context and custom task packs in
`agentdocs.config.yaml`.

Inspect the most useful generated files:

```txt
.agentdocs/llms.txt
.agentdocs/AGENTS.md
.agentdocs/agent-brief.md
.agentdocs/state/build-state.json
.agentdocs/task-packs/
.agentdocs/reports/agent-readiness.md
```

`agent-brief.md` is optimized as the first generated file an agent reads.
`build-state.json` is operational state for `status`, `rebuild --changed`, and
`watch`; it records source fingerprints and build-owned artifact hashes.

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

## Ingest Repository Docs, MDX, Sphinx/reST, and AsciiDoc

Configured `repo` sources reuse local ingestion while preserving repository-relative paths. AgentDocs never clones a remote repository.

AgentDocs natively supports compiling:
* **Markdown and MDX:** Tolerant MDX normalization is the default: strict MDX parsing runs first, then a deterministic sanitizer preserves useful prose, headings, links, and fenced code.
* **Sphinx/reST:** Ingests reStructuredText `.rst` and Sphinx-style `.txt` documentation trees.
* **AsciiDoc/Antora:** Ingests `.adoc` and `.asciidoc` source files.

**Transclusion Resolution:**
Includes are resolved deterministically during ingestion (`.. include::` directives in reST and `include::[]` directives in AsciiDoc). Out-of-scope or missing includes are automatically detected and flagged by `agentdocs doctor` as include gaps to ensure complete context safety.

## Multi-Session Tradeoffs

AgentDocs avoids hidden network checks after a build. Local and repository docs
are considered stale when configured Markdown/MDX content hashes change.
Website crawls are considered stale when their TTL expires, defaulting to 24
hours. That keeps `agentdocs status` predictable and offline, while making
recrawl a deliberate user action.
