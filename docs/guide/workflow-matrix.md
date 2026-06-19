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

## Expansion Candidates

The current test bed covers useful cases, but broad confidence needs multiple
documentation systems, multiple implementation languages, multiple scale
profiles, and multiple kinds of ambiguity. These targets are candidate
regression additions, not completed AgentDocs runs. They should be added as
bounded prepared targets or opt-in live runs before the product is called
polished across large real-world documentation estates.

| Repository | Ecosystem | Docs shape | Why it matters | What should pass |
| --- | --- | --- | --- | --- |
| [`kubernetes/website`](https://github.com/kubernetes/website) | Go / cloud-native | Dedicated docs repo; large Hugo/Docsy site | Massive, versioned, highly linked docs with many examples and multiple contributor patterns | Correct version scoping, sane crawl bounds, strong task packs for deployment/networking/auth, low internal-link breakage |
| [`django/django`](https://github.com/django/django) | Python | Code plus `docs/` in-repo | Canonical Sphinx/reST corpus with long-form tutorials and API docs | Good task routing across tutorial versus reference material; no section mixing across versions |
| [`python/cpython`](https://github.com/python/cpython) | Python / systems | Huge repo with `Doc/` tree | Very large reST corpus, multiple release streams, giant pages, nuanced version notes | Stable build times, no giant-page degradation surprises, good release-version facet handling |
| [`dotnet/docs`](https://github.com/dotnet/docs) | C# / .NET | Giant docs-only repo | Multi-language platform docs with broad conceptual and reference content | Strong retrieval precision, bounded task packs, robust chunking at scale |
| [`spring-projects/spring-framework`](https://github.com/spring-projects/spring-framework) | Java | Code plus `framework-docs` AsciiDoc/Antora | Different docs toolchain from current examples; heavy version semantics | Correct extraction from AsciiDoc, version-safe routing, good how-to versus reference separation |
| [`rust-lang/rust`](https://github.com/rust-lang/rust) | Rust | Huge mixed code and docs repo | Very large codebase with compiler, standard library, and docs in one place | Good repo-source inclusion boundaries, no over-indexing irrelevant internals, useful task packs from docs |
| [`apache/airflow-site`](https://github.com/apache/airflow-site) and [`apache/airflow`](https://github.com/apache/airflow) | Python / data | Docs site plus main code repo | Split-docs-and-code pattern common in real organizations | Successful per-site compile, correct cross-link handling, task packs for DAG authoring and deployment |
| [`hashicorp/terraform`](https://github.com/hashicorp/terraform) | Go / IaC | Large product plus extensive documentation | Strong versioning and operational workflows, excellent fit for migration/provider tasks | Good tutorial/reference distinction, provider/version disambiguation, high-value task packs |
| [`microsoft/TypeScript-Website`](https://github.com/microsoft/TypeScript-Website) | TypeScript | Docs-focused monorepo | Markdown/MDX-heavy website with handbook-style docs and generated schema content | Correct monorepo scoping, strong task packs for config/compiler API concepts, bounded chunking |
| [`fastapi/fastapi`](https://github.com/fastapi/fastapi) | Python | Code plus docs; modern framework docs | Good control sample against the current Fastify/Hono/TanStack set | Clear docs/task retrieval for auth, dependencies, background tasks, and OpenAPI usage |

The first pass for each target should record preparation commands, source
scope, page/chunk/entity/task-pack counts, readiness, repeated-build hash
status, query captures, and at least one human-judged agent task. Large
repositories should prefer scoped local preparation first, then opt-in website
crawls once local ingestion behavior is understood.

The June 19, 2026 candidate expansion run measured the first slice of this
matrix. Kubernetes, FastAPI, Rust, TypeScript Website, Airflow-site, Terraform,
and a scoped .NET docs shard compiled with stable repeated builds. Django,
CPython, Spring Framework, and Airflow main exposed source-format coverage gaps
because their dominant documentation sources are Sphinx/reST or AsciiDoc. See
[Candidate Expansion Metrics](/results/candidate-expansion) for the measured
counts and the two-iteration viability plan.

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
