---
layout: home

hero:
  name: AgentDocs
  text: Make agent docs measurable before agents rely on them
  tagline: "Fresh? Scoped? Evidence-backed? AgentDocs compiles existing docs into deterministic local context you can gate."
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

## What AgentDocs checks

Agents fail when they reuse stale docs, mix versions or frameworks, or start a
task without source-backed evidence. AgentDocs adds a separate context layer
optimized for task execution, without rewriting the source docs.

It puts three questions in front of every agent handoff:

- Is the compiled context fresh?
- Is it scoped to the right version, framework, router, or runtime?
- Does it contain evidence for the task I am about to ask an agent to do?

```txt
docs -> collect -> normalize -> graph -> task packs -> status -> handoff -> MCP
```

Install the published beta from npm:

```bash
npm install --global @somneelsaha/agentdocs
agentdocs try ./docs --goal "implement authentication"
```

Start with the [installation guide](/guide/installation), then complete the
[five-minute quick start](/guide/quick-start). For the design behind
multi-session agent use, read the [agent workflow guide](/guide/agent-workflow).

## From docs to gateable context

<div class="feature-illustration-grid">
  <a class="feature-illustration-card" href="/AgentDocs/guide/quick-start.html">
    <img src="/brand/feature-build.png" alt="Compile documentation into structured outputs" />
    <h3>Compile existing docs</h3>
    <p>Collect, normalize, graph, and generate deterministic local context from existing docs.</p>
  </a>
  <a class="feature-illustration-card" href="/AgentDocs/guide/search-mcp.html">
    <img src="/brand/feature-search.png" alt="Search indexed documentation" />
    <h3>Scope retrieval</h3>
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
    <p>Give coding agents compact task context without silently combining conflicting evidence.</p>
  </a>
  <a class="feature-illustration-card" href="/AgentDocs/guide/search-mcp.html">
    <img src="/brand/feature-mcp-tools.png" alt="Read-only MCP tools for coding agents" />
    <h3>Hand off to agents</h3>
    <p>Serve task context, freshness, verification, setup commands, and source evidence through read-only MCP.</p>
  </a>
  <a class="feature-illustration-card" href="/AgentDocs/guide/architecture.html">
    <img src="/brand/feature-local-first-safe.png" alt="Local-first and safe documentation processing" />
    <h3>Run locally and safely</h3>
    <p>Keep the core offline, treat docs as untrusted input, and never execute crawled commands.</p>
  </a>
</div>

## Why the workflow layer exists

The first version proved that AgentDocs could compile docs into task packs,
search, readiness reports, and MCP resources. The next problem was operational:
an agent needs to reuse the right context tomorrow without rereading the
internet or mixing stale evidence into a task.

AgentDocs now records build state, fingerprints local sources, expires website
crawls by TTL, emits `agent-brief.md`, and exposes `handoff` and
`verify-context` through both CLI and MCP. The tradeoff is intentionally boring:
status checks are deterministic and local, while live recrawling remains an
explicit build action.

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
