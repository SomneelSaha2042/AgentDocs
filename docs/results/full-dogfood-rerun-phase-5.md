# Full Dogfood Rerun Phase 5

Date: June 20, 2026

This rerun rebuilt the documented prepared dogfood targets after the Phase 5
task-routing improvements. It used stored local repositories and prepared crawl
artifacts; no live website recrawl was performed.

The goal was to populate the new routing metrics without replacing older
baselines. Earlier runs remain in the history pages so progress and regressions
can be inspected over time.

## Headline

All nine documented targets completed deterministic builds with stable repeated
artifact hashes. Six targets passed every declared strict routing expectation,
Octokit was captured report-only, and two Hono quickstart expectations failed
because handoff selected a related task pack instead of `quickstart`.

The targeted routing fixes landed on the real corpora:

- Fastify local schema-validation route: passed.
- TanStack React mutation invalidation route: passed.
- Next.js App Router route-handler route: passed.

## Results

| Target | Pages | Chunks | Entities | Task packs | Readiness | Routing |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| AgentDocs self-docs | 13 | 42 | 83 | 4 | 79 | 1/1 |
| Hono local docs | 85 | 778 | 1,236 | 7 | 93 | 1/2 |
| Fastify local docs | 43 | 805 | 944 | 5 | 91 | 2/2 |
| Supabase local MDX | 737 | 6,300 | 5,539 | 11 | 79 | 1/1 |
| TanStack Query local docs | 411 | 2,598 | 1,441 | 9 | 79 | 1/1 |
| Octokit local docs | 14 | 25 | 61 | 4 | 93 | report-only |
| Next.js prepared crawl | 100 | 823 | 640 | 8 | 88 | 1/1 |
| Hono prepared crawl | 100 | 101 | 0 | 4 | 79 | 0/1 |
| Fastify prepared crawl | 100 | 2,526 | 2,158 | 6 | 83 | 1/1 strict, 1 report-only |

`Routing` is strict passed/expected route assertions. `report-only` means a
goal was captured without a hard expected task-pack ID.

## Routing Findings

| Target | Goal | Selected task pack | Result |
| --- | --- | --- | --- |
| AgentDocs self-docs | `install AgentDocs CLI` | `installation` | Pass |
| Hono local docs | `create a Hono app` | `installation` | Failed expected `quickstart` |
| Hono local docs | `deploy Hono to Cloudflare Workers` | `deployment` | Pass |
| Fastify local docs | `build Fastify v5 server with JSON schema validation` | `schema-validation` | Pass |
| Fastify local docs | `migrate to Fastify v5` | `migration` | Pass |
| Supabase local MDX | `configure Supabase auth and Row Level Security` | `authentication` | Pass |
| TanStack Query local docs | `implement React mutation invalidation` | `query-invalidation` | Pass |
| Octokit local docs | `authenticate Octokit REST request` | `authentication` | Report-only |
| Next.js prepared crawl | `build App Router POST route handler` | `route-handlers` | Pass |
| Hono prepared crawl | `create a Hono app` | `authentication` | Failed expected `quickstart` |
| Fastify prepared crawl | `build Fastify v5 server with JSON schema validation` | `schema-validation` | Report-only |
| Fastify prepared crawl | `migrate to Fastify v5` | `migration` | Pass |

## What Changed Since The Workflow Rerun

The June 16 workflow-layer rerun identified missing exact task-pack routing for
Fastify schema validation, TanStack React mutation invalidation, and Next.js
App Router route handlers. This rerun confirms those three cases now select
the intended task packs on real prepared targets.

The same rerun exposed a new Hono quickstart selector issue. The generated
Hono quickstart task pack exists, but the handoff selector prefers
`installation` for local docs and `authentication` for the prepared crawl when
the goal is `create a Hono app`. That is a routing precision issue, not a
collection or build failure.

## Notes

- Prepared crawl rows were rebuilt from stored normalized pages.
- Historical source-coverage metrics remain unavailable for prepared crawl
  artifacts.
- Supabase and TanStack readiness scores are lower in this rerun because source
  coverage gaps are now represented in the build and readiness outputs.
- `agent_task_passed` remains `unknown` unless an implementation task was
  completed using only generated AgentDocs context.
