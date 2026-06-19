# Real-World Results

AgentDocs was tested on real documentation systems with different failure
modes: local repositories, bounded website crawls, large MDX trees,
versioned docs, multi-framework docs, and its own documentation.

> Results baseline: June 11, 2026. Post-hardening rerun: June 12, 2026.
> Agent workflow layer rerun: June 16, 2026. Prepared website crawl artifacts
> were rebuilt without a live recrawl unless explicitly noted.

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

### Unsafe context becomes controllable

The same runs exposed issues that a normal docs build would not identify:

- Fastify v5-filtered migration and schema searches exclude v3 evidence;
- TanStack React-filtered invalidation searches exclude other frameworks;
- unsafe unfiltered searches emit explicit context-conflict warnings;
- Next.js error-handling retrieval preferred Pages Router material for an App
  Router task;
- Hono's website crawl inferred a broader scope and collected examples outside
  the intended docs area;
- Supabase's custom MDX completes with explicit usable, degraded, skipped, and
  failed-file diagnostics.

These are product findings, not just test failures. They identify exactly where
an agent could receive plausible but unsafe guidance.

## Results at a glance

How to read the table:

- **Run status** is the regression outcome for the prepared target. `Passed`
  means build, doctor, search capture, automated expectations, and repeated
  hash comparison completed. `Blocked preparation` means the source corpus
  could not be prepared, so AgentDocs did not run.
- **Compiled pages** are normalized source pages accepted into the AgentDocs
  model after crawl or ingest. For websites, this is bounded by crawl scope and
  `--max-pages`; it is not a count of every page on the upstream site.
- **Generated chunks** are heading-aware text units written to `chunks.jsonl`
  for search and context assembly. `Not recorded` means the public summary kept
  only the page, task-pack, and readiness counts for that historical run; it is
  not a zero.
- **Extracted entities** are deterministic graph items such as packages,
  imports, environment variables, CLI commands, routes, versions, warnings,
  concepts, and task candidates.
- **Task packs** are compact, evidence-linked bundles for task families such as
  quickstart, authentication, migration, errors, deployment, and configuration.
- **Readiness score** is the deterministic `agentdocs doctor` score out of 100.
  It summarizes discoverability, structure, task coverage, version safety,
  agent safety, and runtime readiness. It is useful for gating, but it is not
  the same as an agent-task pass.
- **Repeat build** reports whether the second build produced the same generated
  artifact hash as the first build.

| Target | Source corpus | Run status | Compiled pages | Generated chunks | Extracted entities | Task packs | Readiness score | Repeat build | Main operational finding |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| AgentDocs | Local docs | Passed | 13 pages | Not recorded | Not recorded | 3 packs | 90/100 | Stable hash | Self-dogfood implementation task remains passed |
| Hono | Local repo | Passed | 85 pages | Not recorded | Not recorded | 7 packs | 93/100 | Stable hash | Quickstart task pack restored with source-backed setup evidence |
| Hono | Website | Passed | 100 pages | 101 chunks | 0 entities | 4 packs | 81/100 | Stable hash | Bounded crawl succeeded, but scope drift is visible |
| Fastify | Local repo | Passed | 43 pages | Not recorded | Not recorded | 4 packs | 93/100 | Stable hash | v5-filtered migration and schema results contain only v5 evidence |
| Fastify | Website | Passed | 100 pages | 2,526 chunks | 2,158 entities | 5 packs | 85/100 | Stable hash | Current v5 material ranks well, but minor versions mix |
| TanStack Query | Local repo | Passed | 411 pages | Not recorded | Not recorded | 7 packs | 90/100 | Stable hash | React-filtered retrieval excludes other frameworks |
| Next.js | Website | Passed | 100 pages | 823 chunks | 640 entities | 7 packs | 90/100 | Stable hash | Route handlers rank well; router families mix on other queries |
| Octokit REST | Local docs | Passed | 14 pages | 25 chunks | 61 entities | 4 packs | 95/100 | Stable hash | Small conventional docs compile cleanly |
| Supabase | Local MDX | Passed | 737 pages | Not recorded | Not recorded | 9 packs | 94/100 | Stable hash | Completed with 731 usable, 6 degraded, and 45 failed-file diagnostics |
| Prisma | Local monorepo | Blocked preparation | Not reached | Not reached | Not reached | Not reached | Not reached | Not reached | Upstream Windows-invalid filenames blocked preparation |

All completed regressions reported zero known broken internal links. Every
successful target produced the same generated-artifact hash on its second
build.

## Version history

The published numbers are kept as a history of runs instead of replacing old
findings with the latest summary.

| Date | Run | Main progress |
| --- | --- | --- |
| June 11, 2026 | Baseline | Established first real-world successes and failures across local docs, large MDX trees, versioned docs, multi-framework docs, and prepared website crawls. |
| June 12, 2026 | Post-hardening | Added context safety, tolerant MDX diagnostics, and regression assertions; Supabase completed and filtered Fastify/TanStack retrieval became safer. |
| June 16, 2026 | Workflow layer | Reran all documented prepared targets after adding `status`, `handoff`, `verify-context`, setup snippets, build-state freshness, `agent-brief.md`, and richer MCP tools. All prepared targets passed regression; all reported fresh status. |

Read the [evaluation history](./history.md) for the run-by-run table and the
workflow-layer findings.

## The readiness-score lesson

A readiness score is a useful audit summary, but it is not a workflow pass.

Fastify and TanStack Query still demonstrate why a readiness score alone is
not a workflow pass: broad unfiltered queries can cross context boundaries.
AgentDocs now warns on those mixed results, supports hard filters, and avoids
mixing conflicting evidence in generated task packs. Next.js still requires
explicit App Router context for router-specific work.

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
