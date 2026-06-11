---
layout: home

hero:
  name: AgentDocs
  text: Compile documentation for coding agents
  tagline: Deterministic, local-first, evidence-linked artifacts, audits, search, and MCP.
  image:
    src: /brand/hero-agentdocs.png
    alt: AgentDocs compiling documentation into structured agent context
  actions:
    - theme: brand
      text: Get Started
      link: /guide/installation
    - theme: alt
      text: See Real-World Results
      link: /results/
    - theme: alt
      text: View on GitHub
      link: https://github.com/SomneelSaha2042/AgentDocs

---

## What AgentDocs does

Human documentation is optimized for navigation. AgentDocs adds a separate
context layer optimized for task execution, without rewriting the source docs.

```txt
docs -> collect -> normalize -> graph -> task packs -> search -> doctor -> MCP
```

Start with the [installation guide](/guide/installation), then complete the
[five-minute quick start](/guide/quick-start).

## From docs to agent-ready context

<div class="feature-illustration-grid">
  <a class="feature-illustration-card" href="/AgentDocs/guide/quick-start.html">
    <img src="/brand/feature-build.png" alt="Compile documentation into structured outputs" />
    <h3>Compile existing docs</h3>
    <p>Collect, normalize, graph, and generate deterministic agent-facing artifacts.</p>
  </a>
  <a class="feature-illustration-card" href="/AgentDocs/guide/search-mcp.html">
    <img src="/brand/feature-search.png" alt="Search indexed documentation" />
    <h3>Search offline</h3>
    <p>Build a local SQLite or lexical index and retrieve evidence without network access.</p>
  </a>
  <a class="feature-illustration-card" href="/AgentDocs/reference/artifacts.html">
    <img src="/brand/feature-audit-evidence.png" alt="Trace generated outputs to source evidence" />
    <h3>Trace every claim</h3>
    <p>Link task packs, entities, and findings back to source pages, headings, and code.</p>
  </a>
  <a class="feature-illustration-card" href="/AgentDocs/reference/artifacts.html">
    <img src="/brand/feature-task-packs.png" alt="Task-specific context packs for coding agents" />
    <h3>Generate task packs</h3>
    <p>Give coding agents compact, evidence-backed context for concrete implementation tasks.</p>
  </a>
  <a class="feature-illustration-card" href="/AgentDocs/guide/search-mcp.html">
    <img src="/brand/feature-mcp-tools.png" alt="Read-only MCP tools for coding agents" />
    <h3>Expose read-only MCP</h3>
    <p>Serve validated built artifacts through focused tools without arbitrary file access.</p>
  </a>
  <a class="feature-illustration-card" href="/AgentDocs/guide/architecture.html">
    <img src="/brand/feature-local-first-safe.png" alt="Local-first and safe documentation processing" />
    <h3>Run locally and safely</h3>
    <p>Keep the core offline, treat docs as untrusted input, and never execute crawled commands.</p>
  </a>
</div>

## Proven on real documentation

AgentDocs was tested against its own docs and documentation from Hono, Fastify,
Supabase, TanStack Query, Next.js, and Octokit. The regression suite compiled
successful targets twice, audited their readiness, and compared search results
against concrete agent tasks.

| Result | Evidence |
| --- | --- |
| Deterministic output | Every successful target produced the same artifact hash on its repeated build |
| Large local corpus | TanStack Query compiled 493 pages into 2,600 searchable chunks |
| Large website crawl | Next.js compiled a bounded 100-page crawl into 823 chunks and 7 task packs |
| Actionable failure | Supabase stopped on the exact unsupported MDX partial instead of emitting misleading context |
| Context risk detection | Tests exposed version mixing, framework mixing, weak retrieval, and crawl-scope drift |

The important result is not that every target passed. It is that AgentDocs made
both useful context and unsafe context measurable before a coding agent relied
on it.

[Explore the real-world findings](/results/) or read the
[reproducible methodology](/results/methodology).
