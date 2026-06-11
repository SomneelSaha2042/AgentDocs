# Real-World Results

AgentDocs was tested on real documentation systems with different failure
modes: local repositories, bounded website crawls, large MDX trees,
versioned docs, multi-framework docs, and its own documentation.

> Results snapshot: June 11, 2026. Upstream documentation changes over time,
> so these findings describe the captured sources and bounded crawls used in
> this evaluation.

The goal was not to produce flattering readiness scores. The goal was to learn
whether AgentDocs can give a coding agent useful, scoped, reproducible context
and clearly expose the cases where it cannot.

## What the runs proved

### Useful context is measurable

Successful targets produced searchable chunks, evidence-linked task packs,
readiness reports, and stable repeated builds. Strong retrieval results
included:

- Hono's Cloudflare Workers documentation;
- Fastify's current website migration and schema-validation guidance;
- TanStack Query's React mutation and Svelte query documentation;
- Next.js App Router route-handler documentation;
- AgentDocs' own MCP, doctor, artifact, and contribution documentation.

### Unsafe context becomes visible

The same runs exposed issues that a normal docs build would not identify:

- Fastify local docs ranked a V3 migration guide while the task required v5;
- generic TanStack Query retrieval ranked Angular and Lit before React;
- Next.js error-handling retrieval preferred Pages Router material for an App
  Router task;
- Hono's website crawl inferred a broader scope and collected examples outside
  the intended docs area;
- Supabase's custom MDX caused an explicit parser failure instead of a partial,
  silently incomplete build.

These are product findings, not just test failures. They identify exactly where
an agent could receive plausible but unsafe guidance.

## Results at a glance

| Target | Source | Pages | Chunks | Entities | Task packs | Readiness | Repeat build | Main finding |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| AgentDocs | Local docs | 13 | 42 | 83 | 2 | 88 | Stable | Self-dogfood led directly to `inspect task-pack <id>` |
| Hono | Local repo | 85 | 778 | 1,236 | 7 | 93 | Stable | Runtime retrieval works; quickstart and migration retrieval are missing |
| Hono | Website | 100 | 101 | 0 | 4 | 81 | Stable | Bounded crawl succeeded, but scope drift is visible |
| Fastify | Local repo | 43 | 805 | 944 | 6 | 93 | Stable | High score still hides outdated V3 migration guidance |
| Fastify | Website | 100 | 2,526 | 2,158 | 5 | 85 | Stable | Current v5 material ranks well, but minor versions mix |
| TanStack Query | Local repo | 493 | 2,600 | 1,441 | 7 | 90 | Stable | Framework-specific queries work; generic retrieval mixes frameworks |
| Next.js | Website | 100 | 823 | 640 | 7 | 90 | Stable | Route handlers rank well; router families mix on other queries |
| Octokit REST | Local docs | 14 | 25 | 61 | 4 | 95 | Stable | Small conventional docs compile cleanly |
| Supabase | Local MDX | Build stopped | - | - | - | - | Not reached | Exact unsupported MDX partial identified |
| Prisma | Local monorepo | Blocked on Windows | - | - | - | - | Not reached | Upstream Windows-invalid filenames blocked preparation |

All completed regressions reported zero known broken internal links. Every
successful target produced the same generated-artifact hash on its second
build.

## The readiness-score lesson

A readiness score is a useful audit summary, but it is not a workflow pass.

Fastify local docs scored **93** while ranking a V3 migration guide for a v5
task. TanStack Query scored **90** while a generic invalidation query ranked
Angular first. Next.js scored **90** while error-handling retrieval selected
Pages Router material.

That is why the regression table keeps `agent_task_passed` separate from
readiness and search quality. AgentDocs is intended to improve agent-mediated
developer experience, so the final test is whether an agent can complete a
specific task using the generated context without unsafe ambiguity.

## Why this matters

Without a tool like AgentDocs, documentation quality for agents is often judged
by intuition or by whether a search result looks plausible. These runs replace
that guesswork with inspectable artifacts:

- deterministic build hashes show whether context changes unexpectedly;
- task packs show what evidence an agent receives for a workflow;
- search captures reveal wrong-version and wrong-framework ranking;
- readiness findings identify missing or weak task evidence;
- explicit failures preserve the source file and parser error;
- human task judgments prevent a high aggregate score from being mistaken for
  success.

Read the [detailed target findings](./findings.md) for the evidence behind each
conclusion, or use the [methodology](./methodology.md) to reproduce the runs.
