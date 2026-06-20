---
layout: home

hero:
  name: AgentDocs
  text: Prevent coding agents from using stale, wrong-version, or incomplete documentation
  tagline: "A local context compiler and CI gate that gives coding agents task-specific, source-linked evidence."
  image:
    src: /brand/hero-agentdocs.png
    alt: AgentDocs pixel detective mascot holding documentation and an audit checklist
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

## What AgentDocs Is

Agents fail when they reuse stale docs, mix versions or frameworks, or start a
task without source-backed evidence. AgentDocs compiles existing documentation
into a separate local context layer optimized for task execution, without
rewriting the source docs.

It puts three questions in front of every agent handoff:

- Is the compiled context fresh?
- Is it scoped to the right version, framework, router, runtime, or locale?
- Does it contain evidence for the task I am about to ask an agent to do?

Install the published beta from npm:

```bash
npm install --global @somneelsaha/agentdocs
agentdocs try ./docs --goal "implement authentication"
```

Start with the [installation guide](/guide/installation), then complete the
[five-minute quick start](/guide/quick-start). For the design behind
multi-session agent use, read the [agent workflow guide](/guide/agent-workflow).

## Choose Your Entry Point

| If you... | Start here | Success metric |
| --- | --- | --- |
| Maintain documentation | `agentdocs build && agentdocs doctor` | CI can catch missing task evidence, stale context, source coverage gaps, and unsafe mixed context. |
| Use coding agents on an application | `agentdocs try <url-or-path> --goal "<task>"` | The agent gets a scoped handoff with source pages, task packs, warnings, and setup commands. |
| Operate agent infrastructure | `agentdocs serve-mcp` | Agents can reuse read-only local task context through MCP without arbitrary filesystem access. |

## What It Looks Like

```bash
$ agentdocs verify-context --task "migrate this service to Fastify v5"
WARN: Context needs review.
  Issue: deprecated_evidence
  Selected task pack: migration
  Recommended action: inspect the migration task pack and apply version facets when searching.

$ agentdocs verify-context --task "migrate this service to Fastify v5" --facet version=v5
PASS: Context is safe to use for this task.
  Version boundary: v5
  Task evidence: source-linked migration sections
```

## From docs to gateable context

<div class="feature-illustration-grid">
  <a class="feature-illustration-card" href="/AgentDocs/guide/quick-start.html">
    <img src="/brand/feature-build.png" alt="AgentDocs mascot compiling loose documentation into an organized stack" />
    <h3>Compile existing docs</h3>
    <p>Collect, normalize, graph, and generate deterministic local context from existing docs.</p>
  </a>
  <a class="feature-illustration-card" href="/AgentDocs/guide/search-mcp.html">
    <img src="/brand/feature-search.png" alt="AgentDocs mascot inspecting and filtering documentation with a magnifying glass" />
    <h3>Scope retrieval</h3>
    <p>Filter versions, frameworks, routers, and runtimes while retrieving evidence offline.</p>
  </a>
  <a class="feature-illustration-card" href="/AgentDocs/reference/artifacts.html">
    <img src="/brand/feature-audit-evidence.png" alt="AgentDocs mascot tracing a glowing evidence path between source documentation and generated context" />
    <h3>Trace every claim</h3>
    <p>Link task packs, entities, and findings back to source pages, headings, and code.</p>
  </a>
  <a class="feature-illustration-card" href="/AgentDocs/reference/artifacts.html">
    <img src="/brand/feature-task-packs.png" alt="AgentDocs mascot carrying a tied bundle of verified task documents" />
    <h3>Generate task packs</h3>
    <p>Give coding agents compact task context without silently combining conflicting evidence.</p>
  </a>
  <a class="feature-illustration-card" href="/AgentDocs/guide/search-mcp.html">
    <img src="/brand/feature-mcp-tools.png" alt="AgentDocs mascot connecting verified documentation to local tools" />
    <h3>Hand off to agents</h3>
    <p>Serve task context, freshness, verification, setup commands, and source evidence through read-only MCP.</p>
  </a>
  <a class="feature-illustration-card" href="/AgentDocs/guide/doctor.html">
    <img src="/brand/feature-doctor-readiness.png" alt="AgentDocs mascot beside a readiness gauge, checklist, and verified shield" />
    <h3>Gate readiness</h3>
    <p>Check freshness, coverage, evidence quality, and context conflicts before agents start work.</p>
  </a>
  <a class="feature-illustration-card" href="/AgentDocs/guide/architecture.html">
    <img src="/brand/feature-local-first-safe.png" alt="AgentDocs mascot protecting local documentation with a lock shield" />
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

## Validated Against Real Documentation

AgentDocs was tested against its own docs and documentation from Hono, Fastify,
Supabase, TanStack Query, Next.js, and Octokit. The post-hardening regression
suite compiled successful targets twice, audited readiness, and checked
version, framework, router, locale, content-type, MDX, and task-pack behavior.
Deterministic compilation and context-risk detection are proven. End-to-end
agent-task benchmarks are still in progress.

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

[Read the benchmark summary](/results/benchmark-summary), explore the
[real-world findings](/results/), or read the
[reproducible methodology](/results/methodology).
