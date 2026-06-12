# Dogfood Workflow Matrix

The dogfood matrix tests whether AgentDocs improves agent-mediated developer
experience, not only whether builds and readiness audits succeed.

For the public interpretation of these runs, see
[Real-World Results](/results/) and [Findings by Target](/results/findings).

Every prepared target must run the standard regression capture:

```bash
pnpm regression:dogfood -- <target-directory>
```

Workflow-specific searches are added with repeatable `--query <label=query>`
options. The runner saves the top five results for every query, verifies a
second build has the same generated-artifact hash, and keeps
`agent_task_passed` as an explicit human judgment.

Committed offline fixtures now gate the context boundaries exposed by this
matrix. Run `pnpm regression:fixtures` to verify version, framework, and router
filters; mixed-context warnings; tolerant MDX ingestion; and quickstart
generation. Live target results below remain historical until each target is
prepared and rerun.

## Current Status

| Workflow | Prepared locally | Regression | Agent task | Current finding |
| --- | --- | --- | --- | --- |
| AgentDocs self-dogfood | Yes, docs-only source | Passed: 13 pages, 3 packs, readiness 90 | Passed | `inspect task-pack <id>` remains the completed implementation task |
| Hono dependency-user flow | Yes, local repo and prepared website crawl | Local: 85 pages, 7 packs, 93; prepared crawl: 100 pages, 4 packs, 81 | Pending | Local quickstart task pack is restored with source-backed setup evidence; prepared crawl was rebuilt, not recrawled |
| Fastify versioning flow | Yes, local repo and prepared website crawl | Local: 43 pages, 4 packs, 93; prepared crawl: 100 pages, 5 packs, 85 | Pending | v5-filtered migration and schema searches contain only v5 evidence; unfiltered migration warns about mixed versions |
| Prisma local-docs monorepo | Blocked | Not run | Pending | Upstream repository contains Windows-invalid filenames; sparse checkout did not materialize the intended docs subtree |
| Supabase large-MDX stress test | Yes | Passed: 737 pages, 9 packs, readiness 94 | Pending | Tolerant MDX completed with 731 usable, 6 degraded, and 45 failed files recorded in diagnostics |
| TanStack Query multi-framework test | Yes | Passed: 411 pages, 7 packs, readiness 90 | Pending | React-filtered query invalidation contains only React evidence; unfiltered retrieval warns about framework mixing |
| Next.js large-site crawl | Yes, prepared crawl | Passed: 100 pages, 7 packs, readiness 90 | Pending | Prepared crawl rebuilt deterministically; a live recrawl and App Router agent task remain unjudged |

Octokit REST is an additional prepared local-docs target. Its regression passed
with 14 pages, 4 packs, readiness 95, and a stable repeated build.

All completed post-hardening regressions produced stable repeated-build hashes.
Regression output is stored under each prepared target's
ignored `results/` directory and summarized in
`.dogfood/regression-summary.csv`.

## Workflow Commands

### Hono

```bash
pnpm regression:dogfood -- .dogfood/hono-website \
  --name hono-local-docs \
  --query middleware=middleware \
  --query cloudflare-workers="Cloudflare Workers" \
  --query migration=migration
```

Pass criteria:

- quickstart evidence identifies `npm create hono@latest`;
- routing, middleware, validation, and deployment/runtime topics are captured;
- Cloudflare Workers search returns runtime/deployment docs;
- migration context links to actual migration material;
- the agent task builds GET and POST routes, middleware, supported typed
  validation, and a Cloudflare Workers deployment using only generated context.

### Fastify

```bash
pnpm regression:dogfood -- .dogfood/fastify \
  --name fastify-local-docs \
  --query schema-validation="schema validation" \
  --query plugin=plugin \
  --query migration=migration
```

Pass criteria:

- readiness and generated context state the indexed Fastify version;
- v4 and v5 guidance are not mixed silently;
- plugin, schema, quickstart, and error-handling context is useful;
- the agent task builds a Fastify v5 server with a route, JSON schema
  validation, a plugin, and structured error handling without v4-only APIs.

### Prisma

Prepare `https://github.com/prisma/web` with a local Markdown source at
`./apps/docs/content/docs`. The regression must confirm that unrelated blog and
design-system content is excluded. The agent task defines a `User` model,
creates a migration, instantiates Prisma Client, and queries users.

### Supabase

Prepare `https://github.com/supabase/supabase` with a local Markdown source at
`./apps/docs/content`. The regression must inspect MDX component stripping,
Row Level Security, auth middleware, and type generation. The agent task must
not expose secret keys to the browser.

### TanStack Query

Prepare `https://github.com/TanStack/query` with the intended documentation
path only. The regression must verify React, Svelte, Vue, and Solid examples
are not mixed. The agent task implements a React mutation with invalidation
using React-specific evidence only.

### Next.js

Collect `https://nextjs.org/docs` into a dedicated target. Search route
handlers, server actions, and MDX. The agent task builds a current App Router
POST route handler using only generated context.

## Evaluation Rule

Readiness and search metrics are supporting evidence. A workflow passes only
after its agent task is completed successfully and the result is recorded with:

```bash
--agent-task-passed true
```
