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
generation. The June 16, 2026 workflow-layer rerun rebuilt all documented
prepared targets and then checked `status`, `handoff`, and `verify-context`.
Live website recrawls remain opt-in.

## Current Status

| Workflow | Prepared locally | Regression | Agent task | Current finding |
| --- | --- | --- | --- | --- |
| AgentDocs self-dogfood | Yes, docs-only source | Passed: 13 pages, 3 packs, readiness 90 | Passed | Workflow rerun fresh; `inspect task-pack <id>` remains the completed implementation task |
| Hono dependency-user flow | Yes, local repo and prepared website crawl | Local: 85 pages, 7 packs, 93; prepared crawl: 100 pages, 4 packs, 81 | Pending | Workflow rerun fresh; local handoff selected deployment and verification passed for Cloudflare Worker deployment |
| Fastify versioning flow | Yes, local repo and prepared website crawl | Local: 43 pages, 4 packs, 93; prepared crawl: 100 pages, 5 packs, 85 | Pending | Workflow rerun fresh; unfiltered migration warns about mixed versions; prepared crawl migration still ranks V5 first |
| Prisma local-docs monorepo | Blocked | Not run | Pending | Upstream repository contains Windows-invalid filenames; sparse checkout did not materialize the intended docs subtree |
| Supabase large-MDX stress test | Yes | Passed: 737 pages, 9 packs, readiness 94 | Pending | Workflow rerun fresh; authentication handoff and auth/RLS verification passed |
| TanStack Query multi-framework test | Yes | Passed: 411 pages, 7 packs, readiness 90 | Pending | Workflow rerun fresh; broad framework queries warn about mixed context; exact React invalidation task needs stronger task routing |
| Next.js large-site crawl | Yes, prepared crawl | Passed: 100 pages, 7 packs, readiness 90 | Pending | Workflow rerun fresh from prepared crawl; a live recrawl and App Router agent task remain unjudged |

Octokit REST is an additional prepared local-docs target. Its regression passed
with 14 pages, 4 packs, readiness 95, and a stable repeated build.

All completed post-hardening and workflow-layer regressions produced stable
repeated-build hashes.
Regression output is stored under each prepared target's
ignored `results/` directory and summarized in
`.dogfood/regression-summary.csv`.

## Workflow-Layer Checks

The June 16, 2026 rerun also exercised the new utility layer:

```bash
agentdocs status
agentdocs handoff "<goal>"
agentdocs verify-context --task "<goal>"
```

All rerun targets reported `fresh`. Verification passed where generated task
families matched the goal, such as Hono deployment and Supabase auth/RLS. Other
verification failures were mainly `missing_task_pack` for exact implementation
goals such as Fastify schema routes, React mutation invalidation, and Next.js
App Router POST routes. Those are now tracked as task-routing/product coverage
gaps rather than hidden inside a successful build.

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
