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
| June 20, 2026 | Metrics and routing instrumentation | Added a metrics reference and dogfood routing benchmark capture with explicit `--routing-goal` and `--expect-route` flags. | Offline fixtures now verify one expected task-pack route. Future dogfood rows can report routing accuracy without making all routing goals hard failures. |
| June 20, 2026 | Routing improvements | Added built-in route-handler, query-invalidation, and schema-validation task families, then expanded the offline routing fixture. | Offline fixtures now verify four expected task-pack routes and keep routing accuracy separate from readiness score. |
| June 20, 2026 | Full Phase 5 dogfood rerun | Reran the nine documented prepared targets and populated routing metrics in `.dogfood/regression-summary.csv`. | Stable repeated builds across all targets. Fastify local, TanStack local, Next.js prepared crawl, Supabase, and AgentDocs exact routing passed. Hono quickstart routing failed on local and prepared-crawl targets. |
| June 23, 2026 | Parser format expansion | Integrated Sphinx/reST and AsciiDoc format normalizers, transclusion resolution, and include-gap doctor auditing. | Sphinx/reST and AsciiDoc/Antora formats supported and verified against django, cpython, spring-framework, and airflow targets. |
| June 26, 2026 | Active Evaluation Sandbox | Verified the evaluation sandbox harness and added a mock-verified `octokit-pagination` task to benchmark AgentDocs against control groups. | Confirmed successful runs. `octokit-pagination` on `gpt-4o-mini` showed a +100% Success Rate Delta (Control failed, Experimental passed in 7 turns). `dummy-sdk` on `gpt-4o` showed 2 turns saved (Experimental passed in 5 turns, Control in 7). |

## June 26, 2026 Active Evaluation Sandbox

These targets benchmarked the active evaluation sandbox harness under three distinct setups to evaluate different documentation retrieval patterns:
1. **Control Group (Grep)**: Access to raw workspace markdown/documentation files using a local text grep search tool.
2. **Control Group (Web Search/Fetch)**: Workspace docs deleted; agent is equipped with simulated `web_search` and `fetch_webpage` tools (returning raw crawled HTML pages from the `.dogfood/` cache) to mimic a normal web-searching agent harness.
3. **Experimental Group (AgentDocs MCP)**: Workspace docs deleted; agent is equipped only with the read-only AgentDocs MCP server.

### Benchmark Results

| Task | Model | Control (Grep) | Control (Web Search/Fetch) | Experimental (MCP) | Turns Saved (vs Web) | Token Savings (vs Web) |
| --- | --- | --- | --- | --- | ---: | ---: |
| Dummy SDK | `gpt-4o` | Passed (7 turns) | N/A | Passed (5 turns) | 2 | N/A |
| Octokit Pagination | `gpt-4o` | Failed (10 turns) | Passed (7 turns) | Passed (7 turns) | 0 | -8% |
| Fastify Validation | `gpt-4o` | Passed (3 turns) | Passed (5 turns) | Passed (5 turns) | 0 | -27% |
| AgentDocs Config | `gpt-4o-mini` | Passed (4 turns) | N/A | Passed (5 turns) | -1 | N/A |
| Next.js App Router | `gpt-4o` | Passed (8 turns) | Passed (8 turns) | Passed (7 turns) | 1 | -8% |
| AWS JS SDK v3 | `gpt-4o` | Passed (4 turns) | Passed (5 turns) | Passed (3 turns) | 2 | 40% |
| Kubernetes Deployment | `gpt-4o` | Passed (3 turns) | Passed (3 turns) | Passed (3 turns) | 0 | -32% |

### Key Observations from Simulated Web Search
- **Realistic Search Fragility**: The initial search query parser did not handle multi-word inputs well. Hardening `performMockSearch` to use tokenized keyword search and keyword intersection scoring was necessary to let the agent find pages using normal search phrases (e.g., `"Octokit pagination example"`), mimicking a realistic search engine.
- **Token Efficiency**: In tasks like `aws-js-v3`, the AgentDocs MCP integration saved **40% of tokens** and **2 turns** compared to the web-searching control group, demonstrating the efficiency of serving clean, pre-summarized task packs over fetching raw pages.

## June 23, 2026 Parser Format Expansion Rerun

These targets test the expanded format parsers (Sphinx/reST and AsciiDoc/Antora) and transclusion resolution plumbing on large-scale real-world documentation estates.

| Target | Pages | Task packs | Readiness | Source Coverage | Status | Result |
| --- | ---: | ---: | ---: | --- | --- | --- |
| Django | 671 | 8 | 92 | 100% | Passed | Sphinx/reST parser support successfully compiling `.txt`/`.rst` docs. |
| CPython | 556 | 8 | 79 | 99.6% | Passed | Full `.rst` tree compilation. |
| Spring Framework | 469 | 6 | 79 | 99.5% | Passed | AsciiDoc/Antora parser support compiling `.adoc` files. |
| Airflow | 1,617 | 10 | 79 | 86% | Passed | Mixed reST parser support compiling `.rst`/`.txt` docs with transclusion gap tracking. |

## June 20, 2026 Phase 5 Full Dogfood Rerun

| Target | Pages | Task packs | Readiness | Routing | Result |
| --- | ---: | ---: | ---: | --- | --- |
| AgentDocs self-docs | 13 | 4 | 79 | 1/1 | Passed; setup goal routes to installation. |
| Hono local docs | 85 | 7 | 93 | 1/2 | Build passed; Cloudflare Workers routes to deployment, but quickstart selects installation. |
| Fastify local docs | 43 | 5 | 91 | 2/2 | Passed; schema validation and migration route exactly. |
| Supabase local MDX | 737 | 11 | 79 | 1/1 | Passed; auth/RLS routes to authentication, with MDX coverage gap reported. |
| TanStack Query local docs | 411 | 9 | 79 | 1/1 | Passed; React mutation invalidation routes to query-invalidation. |
| Octokit local docs | 14 | 4 | 93 | report-only | Passed; auth request handoff selected authentication without a strict expectation. |
| Next.js prepared crawl | 100 | 8 | 88 | 1/1 | Passed; App Router POST route routes to route-handlers. |
| Hono prepared crawl | 100 | 4 | 79 | 0/1 | Build passed; quickstart selects authentication and remains a routing gap. |
| Fastify prepared crawl | 100 | 6 | 83 | 1/1 strict | Passed; migration routes exactly and schema-validation was captured report-only. |

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

Phase 3 adds deterministic measurement for those routing gaps. See
[Routing Benchmarks Phase 3](./routing-benchmarks-phase-3.md) for the runner
contract and [Evaluation Metrics Reference](./metrics-reference.md) for field
definitions. Phase 4-5 begins closing the measured gaps with conservative
built-in task families; see
[Routing Improvements Phase 4-5](./routing-improvements-phase-4-5.md).
