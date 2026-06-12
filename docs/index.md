---
layout: home

hero:
  name: AgentDocs
  text: Compile documentation for coding agents
  tagline: Deterministic, local-first, context-safe artifacts, audits, search, and MCP.
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
    <p>Filter versions, frameworks, routers, and runtimes while retrieving evidence offline.</p>
  </a>
  <a class="feature-illustration-card" href="/AgentDocs/reference/artifacts.html">
    <img src="/brand/feature-audit-evidence.png" alt="Trace generated outputs to source evidence" />
    <h3>Trace every claim</h3>
    <p>Link task packs, entities, and findings back to source pages, headings, and code.</p>
  </a>
  <a class="feature-illustration-card" href="/AgentDocs/reference/artifacts.html">
    <img src="/brand/feature-task-packs.png" alt="Task-specific context packs for coding agents" />
    <h3>Generate task packs</h3>
    <p>Give coding agents compact evidence without silently combining conflicting context.</p>
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
Supabase, TanStack Query, Next.js, and Octokit. The post-hardening regression
suite compiled successful targets twice, audited readiness, and checked
version, framework, router, MDX, and task-pack behavior.

| Result | Evidence |
| --- | --- |
| Deterministic output | Every successful target produced the same artifact hash on its repeated build |
| Resilient MDX | Supabase compiled 737 pages while preserving per-file degraded and failed diagnostics |
| Large website crawl | Next.js compiled a bounded 100-page crawl into 823 chunks and 7 task packs |
| Context-safe retrieval | Fastify v5 filters exclude v3 evidence; TanStack React filters exclude other frameworks |
| Context risk detection | Unsafe unfiltered retrieval emits explicit conflict warnings |

The important result is not that every target passed. It is that AgentDocs
makes useful context, unsafe context, and degraded normalization measurable
before a coding agent relies on them.

[Explore the real-world findings](/results/) or read the
[reproducible methodology](/results/methodology).
