---
layout: home

hero:
  name: AgentDocs
  text: Compile documentation for coding agents
  tagline: Deterministic, local-first, evidence-linked artifacts, audits, search, and MCP.
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

features:
  - title: Deterministic first
    details: Build, search, and audit without an LLM or hosted service.
  - title: Evidence linked
    details: Task packs and findings point back to source pages, headings, links, and code blocks.
  - title: Agent ready
    details: Generate llms.txt, AGENTS.md, task packs, structured maps, offline search, and MCP tools.
---

## What AgentDocs does

Human documentation is optimized for navigation. AgentDocs adds a separate
context layer optimized for task execution, without rewriting the source docs.

```txt
docs -> collect -> normalize -> graph -> task packs -> search -> doctor -> MCP
```

Start with the [installation guide](/guide/installation), then complete the
[five-minute quick start](/guide/quick-start).

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
