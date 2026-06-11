# Findings by Target

Each target was chosen for a different documentation challenge. The findings
below distinguish successful compilation from successful agent context.

## AgentDocs self-dogfood

**Result:** 13 pages, 42 chunks, 83 entities, 2 task packs, readiness 88,
stable repeated build.

Search successfully routed MCP, doctor, generated-artifact, and contribution
queries to relevant pages. Inspecting the generated output also exposed a
product usability gap: users could see that a task pack existed, but could not
easily ask why its evidence was selected.

That finding produced a concrete product improvement:
`agentdocs inspect task-pack <id>` now explains a generated task pack and its
evidence in human-readable or JSON form.

**Utility shown:** AgentDocs can audit its own documentation and turn an
observed agent-context problem into a testable CLI feature.

## Hono

### Local repository

**Result:** 85 pages, 778 chunks, 1,236 entities, 7 task packs, readiness 93,
stable repeated build.

Cloudflare Workers and middleware searches returned useful runtime-specific
documentation. Authentication ranked the JWT Authentication Helper. However,
the standard `quickstart` and `migration` searches returned no results.

### Website crawl

**Result:** 100 pages, 101 chunks, 0 entities, 4 task packs, readiness 81,
stable repeated build.

The bounded crawl completed, but inferred `/` as its scope and collected
examples beyond the intended docs area. Cloudflare Workers and middleware
retrieval remained useful, while authentication, quickstart, and migration
returned no results.

**Utility shown:** AgentDocs identifies both strong runtime retrieval and
missing workflow coverage. The website run also makes crawl-scope drift visible
instead of treating 100 collected pages as an automatic success.

## Fastify

### Local repository

**Result:** 43 pages, 805 chunks, 944 entities, 6 task packs, readiness 93,
stable repeated build.

The generated context did not clearly establish that the requested task was for
Fastify v5. More importantly, both `schema validation` and `migration` ranked
the V3 Migration Guide first.

### Website crawl

**Result:** 100 pages, 2,526 chunks, 2,158 entities, 5 task packs, readiness
85, stable repeated build.

The current V5 Migration Guide ranked first for migration, and current plugin
and schema-validation pages ranked well. The generated context still mixed
pages from several v5 minor versions.

**Utility shown:** A high readiness score does not hide wrong-version evidence.
Comparing local and website sources also shows that source selection materially
changes the safety of the generated agent context.

## Supabase

**Result:** Build stopped before artifact generation.

The large MDX tree first exposed a fixture with unsupported syntax. After
fixtures were excluded, the build stopped on:

```txt
apps/docs/content/_partials/api_keys_deprecation.mdx
```

The preserved error reported that its expression could not be parsed with
Acorn. AgentDocs did not emit a partial successful build.

**Utility shown:** Fail-closed behavior prevents incomplete context from looking
trustworthy. The exact source file and parser boundary give maintainers an
actionable compatibility target.

## TanStack Query

**Result:** 493 pages, 2,600 chunks, 1,441 entities, 7 task packs, readiness
90, stable repeated build.

Framework-specific intent was often respected: React mutation retrieval ranked
a React page first, and Svelte query retrieval ranked a Svelte page first.
Generic retrieval was riskier. `query invalidation` ranked Angular first, Lit
second, and React third; top-five results for other queries also crossed
framework boundaries.

**Utility shown:** The corpus can compile at substantial scale while the
captured search evidence reveals framework-mixing risk that page and chunk
counts cannot show.

## Next.js

**Result:** 100 pages, 823 chunks, 640 entities, 7 task packs, readiness 90,
stable repeated build.

`route handlers` correctly ranked the App Router route-handlers page first.
Other workflow queries were weaker:

- `error handling` ranked a Pages Router page first;
- `server actions` ranked an unrelated `maxDuration` page first;
- `mdx` ranked a generic guides page first;
- authentication results mixed App Router and Pages Router evidence.

The crawl also found 721 internal links beyond its 100-page budget, confirming
that the bounded result represented only part of a large, mixed-router site.

**Utility shown:** AgentDocs can find excellent task evidence while still
surfacing adjacent retrieval that would make an App Router implementation
unsafe.

## Octokit REST

**Result:** 14 pages, 25 chunks, 61 entities, 4 task packs, readiness 95,
stable repeated build.

This smaller, conventional documentation set compiled cleanly and serves as a
useful baseline beside the larger and more ambiguous targets.

**Utility shown:** The same workflow works for compact docs without requiring a
large-site setup.

## Prisma

**Result:** Target preparation blocked before AgentDocs ran.

The upstream repository contains filenames that Windows cannot materialize.
Sparse checkout did not produce the intended documentation subtree.

**Utility shown:** This is an infrastructure limitation, not an AgentDocs
result. Recording it separately keeps the evaluation honest and prevents an
untested target from being labeled as a product failure or success.

## Open evaluation status

The self-dogfood agent task passed because it resulted in an implemented and
tested product change. Dependency implementation tasks remain unjudged. Their
build, readiness, and retrieval results are evidence, but they are not a
substitute for completing the specified coding task using only generated
context.

See the [methodology](./methodology.md) for commands, recorded fields, and pass
criteria.
