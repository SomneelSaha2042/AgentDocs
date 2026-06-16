# Evaluation History

AgentDocs keeps dogfood results as a timeline, not a single polished number.
That matters because the product is improving along two axes at once:

- compiler reliability: can docs be collected, normalized, built, searched, and
  audited deterministically;
- agent workflow quality: can a coding agent safely reuse the right context
  across sessions without mixing stale, deprecated, or wrong-version evidence.

Prepared website crawl artifacts are rebuilt from stored normalized pages unless
a run explicitly says it was a live recrawl.

## Run History

| Date | Run | What changed | Result |
| --- | --- | --- | --- |
| June 11, 2026 | Initial real-world baseline | Ran AgentDocs across self-docs, Hono, Fastify, Supabase, TanStack Query, Next.js, Octokit, and Prisma preparation. | Established baseline failures and risks: Supabase MDX stopped the build, Fastify local retrieval favored v3 migration evidence, TanStack broad retrieval mixed frameworks, Prisma preparation was blocked on Windows filenames. |
| June 12, 2026 | Post-hardening rerun | Added context facets, tolerant MDX diagnostics, repo-source hardening, and regression assertions. | Successful prepared targets rebuilt deterministically. Supabase completed with diagnostics; Fastify and TanStack filtered retrieval became context-safe; broad mixed-context retrieval emitted warnings. |
| June 16, 2026 | Agent workflow layer rerun | Added `status`, `handoff`, `verify-context`, `setup-agent`, `rebuild --changed`, `watch`, `agent-brief.md`, build-state freshness, and richer MCP tools. | All documented prepared targets passed dogfood regression again. `status` reported fresh across all 9 rerun targets. Workflow verification passed where a matching task pack existed and exposed missing exact-goal task packs elsewhere. |

## June 16, 2026 Workflow-Layer Rerun

| Target | Pages | Task packs | Readiness | Regression | Workflow-layer signal |
| --- | ---: | ---: | ---: | --- | --- |
| AgentDocs self-docs | 13 | 3 | 90 | Passed | Fresh; self-dogfood task remains passed. Exact `serve MCP context` verification had no matching task pack, which points to task-routing coverage rather than build failure. |
| Hono local docs | 85 | 7 | 93 | Passed | Fresh; `handoff` selected `deployment`; `verify-context` passed for Cloudflare Worker deployment. |
| Fastify local docs | 43 | 4 | 93 | Passed | Fresh; unfiltered migration correctly warns about mixed v3/v4/v5 context. Exact Fastify v5 schema goal needs stronger task-pack routing. |
| Supabase local MDX | 737 | 9 | 94 | Passed | Fresh; `handoff` selected `authentication`; `verify-context` passed for auth and Row Level Security. |
| TanStack Query local docs | 411 | 7 | 90 | Passed | Fresh; broad framework queries warn about mixed context. Exact React mutation-invalidation goal needs stronger task-pack routing. |
| Octokit local docs | 14 | 4 | 95 | Passed | Fresh; compact REST docs baseline remains stable. Exact auth request goal did not map to a generated task pack. |
| Next.js prepared crawl | 100 | 7 | 90 | Passed | Fresh from prepared crawl rebuild; exact App Router POST route goal needs stronger task-pack routing. |
| Hono prepared crawl | 100 | 4 | 81 | Passed | Fresh from prepared crawl rebuild; live recrawl remains opt-in. |
| Fastify prepared crawl | 100 | 5 | 85 | Passed | Fresh from prepared crawl rebuild; migration still routes to the V5 Migration Guide first. |

## What Improved

- Freshness is now measurable through `.agentdocs/state/build-state.json` and
  `agentdocs status`.
- `agentdocs handoff` gives agents a reusable task entry point instead of
  forcing them to start with raw search.
- `agentdocs verify-context` separates successful builds from task-specific
  safety. A failure can now mean "the docs compiled, but this exact task needs
  better task-pack routing or narrower facets."
- MCP exposes richer task-oriented tools while staying read-only.

## What Is Still Open

The workflow-layer rerun did not turn dependency implementation tasks into
passes. Most remain `unknown` until an agent actually completes the task using
only AgentDocs context. The new verification failures are useful because they
show where built-in task families should expand next: route handlers, schema
validation, React mutation invalidation, and SDK request/auth workflows.
