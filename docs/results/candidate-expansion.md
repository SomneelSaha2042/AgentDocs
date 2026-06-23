# Candidate Expansion Metrics And Viability Gaps

Run date: June 19, 2026.

> Historical snapshot: June 19, 2026. Some gaps identified here have since
> been partially addressed, including source coverage reporting in build,
> manifest, doctor, and dogfood summaries. Keep this page as historical
> evidence, and use the current results pages for present capability claims.

These metrics expand the dogfood suite toward larger and more varied
documentation estates. They are not final pass/fail judgments for agent tasks.
They show what AgentDocs can compile today, where retrieval looks useful, and
where source format or scale gaps should drive product work.

The run used sparse local checkouts under `.dogfood/candidates`. For large
repositories, only documentation-relevant paths were prepared. For the local
compile path, AgentDocs currently ingests Markdown and MDX only, so Sphinx reST
and AsciiDoc trees are recorded as coverage gaps unless a Markdown subset was
available.

## What This Proves

AgentDocs is close to a viable beta for Markdown-heavy documentation systems.
The candidate run compiled large local documentation trees deterministically,
produced schema-valid artifacts, kept repeated-build hashes stable, and exposed
retrieval problems that are specific enough to fix.

The same run also shows the remaining viability gaps. AgentDocs should not
claim broad documentation-system support until it can measure source coverage,
ingest Sphinx/reST and AsciiDoc/Antora, and handle giant docs-only repositories
with explicit budgets instead of long-running opaque builds.

## Compile Metrics

| Target | Pages | Chunks | Entities | Task packs | Readiness | Broken links | Rebuild stable | Main finding |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| Kubernetes website, English docs subset | 1,603 | 16,011 | 7,788 | 8 | 91 | 0 | Yes | Large Markdown/Hugo corpus compiled deterministically; deprecation and giant-page signals are plentiful. |
| FastAPI docs | 1,518 | 15,065 | 6,053 | 8 | 89 | 0 | Yes | Large Markdown framework docs compiled; search found dependencies, background tasks, errors, and OpenAPI evidence. |
| Rust `src/doc` subset | 641 | 4,095 | 2,735 | 6 | 86 | 0 | Yes | Mixed Rust documentation compiled, but auth-oriented generic searches rank irrelevant governance material. |
| TypeScript website copy | 286 | 2,352 | 3,056 | 4 | 84 | 0 | Yes | Handbook/config/compiler concepts compiled; task-pack coverage is thinner than search coverage. |
| Airflow website Markdown subset | 60 | 674 | 697 | 7 | 90 | 0 | Yes | Website repo compiled, but top queries skew toward news/blog-style pages, showing a scoping problem. |
| Terraform docs subset | 12 | 113 | 33 | 2 | 86 | 0 | Yes | Small in-repo docs subset compiled; it is useful for internals/plugin protocol, not end-user Terraform workflows. |
| .NET docs `docs/ai` subset | 66 | 555 | 262 | 7 | 90 | 0 | Yes | Scoped giant-repo compile works and returns useful AI/auth/RAG evidence. |

The full materialized `dotnet/docs` Markdown set contained 13,679 Markdown
files and did not complete inside a 20-minute wrapper on this Windows run. That
is a scale finding, not a failed correctness result. It argues for explicit
large-repo budgets, progress reporting, sharded builds, and documented scoped
source recipes.

## No Unexplained N/A

The expansion run deliberately avoids treating missing numbers as neutral.
Every missing or partial metric should fall into one of these categories:

| Category | Meaning | Current examples | Required product response |
| --- | --- | --- | --- |
| Unsupported source format | The docs corpus exists, but AgentDocs cannot ingest its dominant file format yet. | Django `.txt` reST, CPython `.rst`, Spring `.adoc`, Airflow main reST | Add parser support and source coverage reporting before counting readiness. |
| Scale limit reached | The corpus is in a supported format, but a whole-repo run is too large for the current workflow. | Full `dotnet/docs` Markdown tree | Add budgets, progress, resumability, and scoped recipes. |
| Scope mismatch | The run compiled files, but the selected source path was not representative of the user-facing docs. | Terraform in-repo docs, Airflow-site news/release pages | Improve docs/product scoping and content-type facets. |
| Retrieval mismatch | The build succeeded, but a common task query ranked irrelevant material. | Rust `authentication`, FastAPI localized quickstart, Airflow workflow queries | Add task-domain, locale, and content-type ranking signals. |

Future result tables should use these labels instead of `N/A`, `Not recorded`,
or silent omission. A run that compiles only a one-page Markdown sliver of a
large reST or AsciiDoc corpus is a coverage failure, not a pass.

## Source Coverage Gaps (Resolved)

In the June 23, 2026 update, all four of these format support gaps have been resolved:
- **Django**: Added Sphinx/reST parser support, successfully compiling 671 pages of `.txt`/`.rst` documentation (100% coverage, 92/100 readiness).
- **CPython**: Full `.rst` Doc tree compilation added, successfully ingesting 556 pages (99.6% coverage, 79/100 readiness).
- **Spring Framework**: Added AsciiDoc/Antora parser support, successfully compiling 469 pages (99.5% coverage, 79/100 readiness).
- **Airflow**: Integrated parser support, compiling 1,617 pages of `.rst`/`.txt` documentation with deterministic skip and transclusion gap tracking (86% coverage, 79/100 readiness).

## Retrieval Observations

- Kubernetes search produced useful top results for deployment, networking,
  authentication, and `kubectl`, which supports the value of local Markdown
  ingestion on a large Hugo docs tree.
- FastAPI compiled at similar scale and surfaced dependencies, background
  tasks, errors, and OpenAPI pages. Its quickstart search ranked localized
  editor-support material, so locale/facet handling should become a first-class
  readiness concern.
- Airflow-site compiled cleanly but search results skewed toward release/news
  pages for workflow queries. Repo scoping should distinguish docs, blog,
  landing pages, and release posts.
- TypeScript search was useful for `tsconfig`, handbook, modules, and errors,
  but the generated task-pack set was not as strong as the search evidence.
  Task-pack heuristics need more concept/config families.
- Rust compiled well, but generic authentication search returned repository
  governance material. AgentDocs needs task-domain awareness so irrelevant
  non-product pages do not satisfy operational queries.
- Tiny Markdown-only passes for Django, Spring, and Airflow main are false
  positives if read naively. Future metrics should report source coverage ratio,
  not only compiled page count and readiness.

## Next Two Iterations

These are the shortest paths from the current beta to a stronger viability
claim.

### Iteration 1: Make Coverage Honest

Goal: prevent false confidence.

- Add a source coverage metric: supported files, unsupported docs files,
  skipped files, failed files, and percentage of the intended corpus compiled.
- Surface coverage in `doctor`, `build --json`, dogfood summaries, and docs
  result tables.
- Treat tiny Markdown-only passes in mostly reST/AsciiDoc repos as warnings or
  failures unless the source scope explicitly says that is intended.
- Add content-type and locale facets for docs, blog/news, release notes,
  reference, tutorial, and localized pages.
- Add scoped recipes for giant repos, starting with `dotnet/docs`.

Acceptance: the candidate table can replace every missing metric with
`unsupported_format`, `scale_limited`, `scope_mismatch`, or
`retrieval_mismatch`, each with a recommended next action.

### Iteration 2: Expand Source Formats And Scale

Goal: compile the currently uncovered confidence targets.

- Add Sphinx/reST ingestion for `.rst` and Django-style `.txt` files.
- Add AsciiDoc/Antora ingestion for `.adoc` and `.asciidoc` files.
- Add large-repo budgets for max files, max bytes, max pages, and max elapsed
  time, plus progress output and resumable state.
- Improve task-pack families for language concepts and configuration workflows,
  especially TypeScript compiler/config and Rust ownership/Cargo workflows.
- Re-run Django, CPython, Spring, Airflow main, and full or sharded
  `dotnet/docs`.

Acceptance: Django, CPython, Spring Framework, Airflow main, and a large
`dotnet/docs` shard produce honest coverage metrics, stable repeated builds,
and useful task-context retrieval without relying on hand-picked Markdown
slivers.

## Product Work Backlog

1. Add a source coverage metric: supported files, unsupported docs files, and
   percentage of documentation corpus compiled.
2. Add Sphinx/reST ingestion, including Django-style `.txt` source files and
   CPython-style `.rst` trees.
3. Add AsciiDoc/Antora ingestion for Spring-style documentation.
4. Add locale and content-type facets so localized pages, blogs, release posts,
   and reference docs do not silently outrank task docs.
5. Add large-repo controls: max files, max bytes, progress logs, sharded build
   state, and better timeout reporting.
6. Add task-pack families for language concepts and configuration workflows,
   especially TypeScript compiler/config and Rust ownership/cargo workflows.
7. Document scoped recipes for giant docs-only repos such as `dotnet/docs`.

## Reproduction Notes

The candidate metric artifacts were written under `.dogfood/candidates`, which
is ignored by Git. Each completed target has a standard
`results/summary.json` from `scripts/dogfood-regression.mjs`; the aggregated
summary is stored locally as:

```txt
.dogfood/candidates/candidate-metrics-summary.json
.dogfood/candidates/source-format-counts.json
```

The default test suite remains fixture-based and offline. These candidate runs
are opt-in dogfood evidence, not required CI gates.
