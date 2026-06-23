# Real-World Results

For the executive view, start with the
[Benchmark Summary](./benchmark-summary.md). This page keeps the detailed
target table and historical context.

AgentDocs was tested on real documentation systems with different failure
modes: local repositories, bounded website crawls, large MDX trees,
versioned docs, multi-framework docs, and its own documentation.

> Results baseline: June 11, 2026. Post-hardening rerun: June 12, 2026.
> Agent workflow layer rerun: June 16, 2026. Prepared website crawl artifacts
> were rebuilt without a live recrawl unless explicitly noted. Candidate
> expansion metrics were captured on June 19, 2026. A full Phase 5 dogfood
> rerun populated routing metrics on June 20, 2026. A parser format expansion
> rerun was verified on June 23, 2026.

The goal was not to produce flattering readiness scores. The goal was to learn
whether AgentDocs can give a coding agent useful, scoped, reproducible context
and clearly expose the cases where it cannot. These results validate
deterministic compilation and context-risk detection; end-to-end
agent-implementation benchmarks are still in progress.

These results are a useful beta baseline, not the final confidence bar. Before
AgentDocs should be considered polished for broad use, the workflow matrix
should expand across larger and more varied documentation shapes. With the
June 23, 2026 update, Sphinx/reST trees and AsciiDoc/Antora sources are supported and verified.
Other candidates like versioned Hugo/Docsy docs, docs-only mega repos, and split
docs/code repositories are tracked in the
[dogfood workflow matrix](/guide/workflow-matrix#expansion-candidates).
The first expansion metric run is recorded in
[Candidate Expansion Metrics](./candidate-expansion.md), including the
remaining viability gaps and the next two product iterations. See the
[Evaluation Metrics Reference](./metrics-reference.md) for field definitions
and the [Routing Benchmarks Phase 3](./routing-benchmarks-phase-3.md) note for
the task-pack routing metric. The
[Routing Improvements Phase 4-5](./routing-improvements-phase-4-5.md) note
records the first expanded exact-route checks. The
[Full Dogfood Rerun Phase 5](./full-dogfood-rerun-phase-5.md) note records
the latest prepared-target results.

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

- **Pipeline regression** is the automated outcome for the prepared target. `Passed`
  means build, doctor, search capture, automated expectations, and repeated
  hash comparison completed. `Passed with routing failure` means the pipeline
  completed but one or more strict task-context expectations failed. `Blocked
  preparation` means the source corpus could not be prepared, so AgentDocs did
  not run.
- **Task-context verification** reports strict routing expectations when
  declared. It is separate from pipeline success.
- **Agent implementation** remains `Not evaluated` unless a coding agent
  completed the task using only generated AgentDocs context.
- **Compiled pages** are normalized source pages accepted into the AgentDocs
  model after crawl or ingest. For websites, this is bounded by crawl scope and
  `--max-pages`; it is not a count of every page on the upstream site.
- **Generated chunks** are heading-aware text units written to `chunks.jsonl`
  for search and context assembly. `Historical metric not captured` means the
  public summary kept only the page, task-pack, and readiness counts for that
  historical run; it is not a zero.
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
- **Routing accuracy** reports explicit task-pack routing expectations when a
  run declares them. Historical rows may not have this metric.

| Target | Source corpus | Pipeline regression | Task-context verification | Agent implementation | Readiness audit | Repeat build | Main operational finding |
| --- | --- | --- | --- | --- | ---: | --- | --- |
| AgentDocs | Local docs | Passed | 1/1 | Passed | 79/100 conditional | Stable hash | Setup routing now selects installation; self-dogfood task remains passed |
| Hono | Local repo | Passed with routing failure | 1/2 | Not evaluated | 93/100 conditional | Stable hash | Cloudflare Workers routes to deployment; quickstart goal still selects installation |
| Hono | Website | Passed with routing failure | 0/1 | Not evaluated | 79/100 conditional | Stable hash | Prepared crawl still builds, but quickstart handoff selects authentication |
| Fastify | Local repo | Passed | 2/2 | Not evaluated | 91/100 conditional | Stable hash | v5 schema-validation and migration goals route exactly |
| Fastify | Website | Passed | 1/1 strict, 1 report-only | Not evaluated | 83/100 conditional | Stable hash | Migration routes exactly; schema-validation is captured report-only |
| TanStack Query | Local repo | Passed | 1/1 | Not evaluated | 79/100 conditional | Stable hash | React mutation invalidation now routes to query-invalidation |
| Next.js | Website | Passed | 1/1 | Not evaluated | 88/100 conditional | Stable hash | App Router POST route now routes to route-handlers |
| Octokit REST | Local docs | Passed | report-only | Not evaluated | 93/100 conditional | Stable hash | Auth request handoff selects authentication in report-only routing |
| Supabase | Local MDX | Passed | 1/1 | Not evaluated | 79/100 conditional | Stable hash | Auth/RLS routes exactly; MDX coverage gap remains explicit |
| Prisma | Local monorepo | Blocked preparation | Not evaluated | Not evaluated | Not evaluated | Not evaluated | Upstream Windows-invalid filenames blocked preparation |
| Django | Local Sphinx/reST | Passed | Not evaluated | Not evaluated | 92/100 | Stable hash | Sphinx/reST parser support successfully compiling 671 pages (100% coverage). |
| CPython | Local Sphinx/reST | Passed | Not evaluated | Not evaluated | 79/100 conditional | Stable hash | Full `.rst` tree compilation ingesting 556 pages (99.6% coverage). |
| Spring Framework | Local AsciiDoc | Passed | Not evaluated | Not evaluated | 79/100 conditional | Stable hash | AsciiDoc/Antora parser support compiling 469 pages (99.5% coverage). |
| Airflow | Local mixed reST | Passed | Not evaluated | Not evaluated | 79/100 conditional | Stable hash | Mixed reST parser support compiling 1,617 pages (86% coverage) with transclusion gap tracking. |

Compile counts remain available in the
[Full Dogfood Rerun Phase 5](./full-dogfood-rerun-phase-5.md) and historical
tables. They are useful diagnostics, but they are not adoption outcomes.

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
| June 19, 2026 | Candidate expansion | Ran larger candidate metrics across Kubernetes, FastAPI, Rust, TypeScript, Airflow-site, Terraform, and a .NET docs shard; identified source-format, scale, scope, and retrieval gaps before broad-use polish. |
| June 20, 2026 | Routing improvements | Added deterministic route-handler, query-invalidation, and schema-validation task families with offline exact-route fixture checks. |
| June 20, 2026 | Full Phase 5 dogfood rerun | Reran nine documented prepared targets and populated routing metrics. Fastify schema validation, TanStack React invalidation, and Next.js App Router routing passed; Hono quickstart routing remains open. |
| June 23, 2026 | Parser format expansion | Integrated Sphinx/reST and AsciiDoc format normalizers, transclusion resolution, and include-gap readiness doctor auditing. Verified against django, cpython, spring-framework, and airflow dogfood targets. |

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
