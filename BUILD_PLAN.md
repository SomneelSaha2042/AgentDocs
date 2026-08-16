# Build Plan: AgentDocs v1

This is the active implementation plan for taking AgentDocs from a usable beta
to a publishable v1 product.

AgentDocs already has the main packages, CLI, generated artifacts, search,
doctor checks, workflow commands, and MCP server. This plan is not a scaffold
plan. It is a product-hardening plan whose phases must produce visible,
inspectable context improvements, not only passing tests.

## Product spine

The v1 product path is:

```txt
ingest/build docs -> generate task-shaped artifacts -> serve consistent CLI/MCP context -> verify freshness and evidence -> prove the output on real targets
```

The primary user workflow is:

```bash
agentdocs try <url-or-path> --goal "implement authentication"
agentdocs handoff "implement authentication"
agentdocs setup-agent
agentdocs serve-mcp
agentdocs verify-context --task "implement authentication"
agentdocs status
```

The maintainer workflow remains:

```bash
agentdocs build
agentdocs doctor
agentdocs search "authentication"
agentdocs export --format static --to ./dist-agentdocs
```

## Execution rules

For every phase:

1. Read `AGENTS.md`, `PRD.md`, `APIS_AND_DOCUMENTATION.md`, `ARCHITECTURE.md`,
   and this file before changing behavior.
2. Verify current code and artifacts before updating architecture or product
   claims.
3. Keep the deterministic, local-first path mandatory and LLM-free.
4. Preserve source evidence for generated task packs, warnings, entities, and
   context bundles.
5. Avoid benchmark-shaped or package-specific routing logic. Improvements must
   be generic and based on organic documentation evidence.
6. Do not proceed to the next phase until the gate passes.

Each phase must leave an implementation note or result artifact describing what
changed, how it was verified, what product output improved, and what limitations
remain.

## Phase 0: Baseline And Architecture Truth

### Goal

Make the root documentation and architecture describe the current product
truth, then capture a reproducible baseline before further v1 hardening.

### Deliverables

- `ARCHITECTURE.md` reflects current package responsibilities, workflow
  commands, generated artifacts, CI coverage, and known gaps.
- Root contract docs use the current v1 product language instead of old
  scaffold-phase language.
- A checked-in baseline note under `docs/results/` records a real build target:
  page count, chunk count, task-pack count, doctor score, selected context for
  at least three goals, and approximate context size.

### Product proof

Run AgentDocs on at least one local target, preferably this repository's docs or
the hardening fixture, and inspect the generated `llms.txt`, generated
`AGENTS.md`, task packs, readiness report, and a `handoff` output.

### Gate

```bash
pnpm typecheck
pnpm test
pnpm regression:fixtures
pnpm docs:build
```

The phase passes only when the docs and architecture describe implemented
behavior, not intended historical phases.

## Phase 1: Golden Workflow UX

### Goal

Make the first-run user experience clear enough that a developer or coding agent
knows what to read first, which warnings matter, and how to connect MCP.

### Deliverables

- `agentdocs try`, `context`, `handoff`, `setup-agent`, `status`, and
  `verify-context` have consistent human and JSON output.
- Handoff/setup output includes the correct `--out` path in MCP launch commands.
- MCP tool allowlists are enforced at call time, not only hidden from
  `tools/list`.
- README and CLI docs show the golden workflow as the primary path.

### Product proof

Run:

```bash
agentdocs try fixtures/basic-docs --goal "create a client"
agentdocs handoff "create a client"
agentdocs setup-agent --client codex
agentdocs verify-context --task "create a client"
```

The output must identify read-first context, selected task evidence, freshness,
warnings, and MCP setup without requiring the user to inspect raw artifacts.

### Gate

- CLI workflow tests cover human and JSON output.
- MCP tests cover allowed-tool enforcement and setup command consistency.
- Release smoke and package smoke still pass.

## Phase 2: One Context Brain

### Goal

Make CLI and MCP serve the same context decisions for the same goal.

### Deliverables

- Context selection, task-pack selection, warning generation, read-first
  citations, and confidence calculation live behind one shared module interface.
- CLI `context`, CLI `handoff`, CLI `verify-context`, MCP `query_docs`, and MCP
  `get_task_context` delegate to that shared context behavior.
- Duplicate selection or verification logic in CLI/MCP adapters is removed or
  reduced to formatting.

### Product proof

For three goals on the hardening fixture, compare:

```bash
agentdocs context "<goal>"
agentdocs handoff "<goal>"
agentdocs verify-context --task "<goal>"
```

Then call MCP `query_docs` and `get_task_context` against the same built
artifacts. The selected task pack, warnings, citations, and confidence must
agree across surfaces.

### Gate

- Shared context tests cover task selection, warning reasons, citations, and
  confidence.
- CLI/MCP parity tests pass.
- `pnpm regression:fixtures` passes without expanding context size unless the
  added evidence is visible in the proof output.

## Phase 3: Generic Compiler Hardening

### Goal

Ensure task-pack generation is task-shaped without being benchmark-shaped.

### Deliverables

- Default task families and scoring signals are generic and defensible under
  the no-evaluation-gaming rule in `AGENTS.md`.
- Benchmark/package/domain-specific task names or bonuses are removed from
  defaults or moved behind explicit user configuration.
- Task-pack diagnostics explain why a pack exists: winning evidence, weak
  evidence, code examples selected, and warnings.
- High-confidence task packs require both implementation evidence and relevant
  code or command evidence.

### Product proof

Regenerate fixture task packs and inspect the output for implementation goals.
The task packs must be compact, evidence-linked, and free of package-specific
or benchmark-specific default routing.

### Gate

- Generator regression tests pass.
- Task-pack fixture snapshots or assertions prove generic routing behavior.
- `ARCHITECTURE.md` records the compiler rules and any remaining limitations.

## Phase 4: Ingestion Contract Closure

### Goal

Make advertised source support match implemented behavior exactly.

### Deliverables

- Local markdown, repo, and website behavior is documented in root docs and
  CLI docs using current implementation details.
- OpenAPI support is closed by deferring ingestion and rejecting OpenAPI config/source attempts at validation or collection time with a clear "planned, not supported in this build" error.
- Parser diagnostics explain weak context causes such as degraded MDX,
  missing pages, sparse headings, stripped components, or no task-shaped
  evidence.

### Product proof

Run ingestion/build targets that demonstrate the deferred OpenAPI behavior: configured OpenAPI sources and direct OpenAPI file ingestion fail early with clear messages, while supported markdown/repo/website sources still build.

### Gate

- Normalizer, CLI, graph, generator, and schema tests pass where affected.
- No source type documented as supported fails later as a surprise.
- Default tests remain network-free.

## Phase 5: Product Proof Runs

### Goal

Prove the product promise on real artifacts before calling v1 publishable.

### Deliverables

- `docs/results/v1-product-proof.md` records repeatable runs for:
  - `fixtures/basic-docs`;
  - the hardening fixture;
  - this repository's docs;
  - one prepared target already present in the repo.
- Each run records build summary, doctor score, task packs, top context or
  handoff for three goals, MCP `query_docs` output, and approximate context
  size.
- Product issues discovered during proof runs are fixed or listed as explicit
  v1 limitations.

### Product proof

Generated outputs must show smaller, relevant, source-backed context compared
with raw-doc browsing. The proof is artifact inspection plus repeatable
commands, not a new formal evaluation harness.

### Gate

- Product proof commands are repeatable locally.
- `pnpm regression:fixtures` passes.
- `pnpm check` passes, or any failure is documented as a release blocker.

## Phase 6: Publishable v1 Package

### Goal

Prepare the npm package, docs, CI, and release notes for a v1 publication.

### Deliverables

- README and package docs present the golden workflow, supported sources,
  generated artifacts, MCP setup, verification commands, and limitations.
- CI includes the existing build/typecheck/test/docs/package gates and a
  lightweight product smoke over the v1 workflow.
- Package contents are verified and an installed tarball can run the golden
  workflow against a fixture.
- Release notes identify supported source types, MCP tools, safety boundaries,
  known limitations, and upgrade notes from beta.

### Gate

```bash
pnpm check
pnpm regression:fixtures
pnpm pack:verify
pnpm smoke:bundle
node scripts/install-packed-cli.mjs
node scripts/release-smoke.mjs agentdocs
```

The phase passes when the local tarball install works and all v1 limitations
are explicit.

## Current CI baseline

The current GitHub CI matrix runs on Ubuntu Node 20, Ubuntu Node 22, and Windows
Node 20. The baseline CI commands are:

```bash
pnpm install --frozen-lockfile
pnpm audit:high
pnpm build
pnpm typecheck
pnpm test
pnpm regression:fixtures
pnpm docs:build
pnpm pack:verify
pnpm smoke:bundle
node scripts/install-packed-cli.mjs
node scripts/release-smoke.mjs agentdocs
```

The v1 work should add only product-protecting CI. Do not add a large evaluation
harness to CI in this plan.

## v1 definition of done

AgentDocs v1 is publishable when a developer can run the golden workflow on an
existing docs source and get compact, relevant, source-backed context through
both CLI and MCP.

Minimum command path:

```bash
agentdocs try <url-or-path> --goal "implement authentication"
agentdocs handoff "implement authentication"
agentdocs setup-agent
agentdocs serve-mcp
agentdocs verify-context --task "implement authentication"
agentdocs status
```

Minimum artifact set:

```txt
llms.txt
AGENTS.md
.agentdocs/manifest.json
.agentdocs/agent-map.json
.agentdocs/documentation-map.json
.agentdocs/chunks.jsonl
.agentdocs/task-packs/*.md
.agentdocs/reports/agent-readiness.md
.agentdocs/index.sqlite
.agentdocs/agent-brief.md
.agentdocs/state/build-state.json
```

Minimum guarantees:

- deterministic core pipeline;
- no required LLM dependency;
- no account or hosted service required;
- no mutation of source docs;
- schema-valid JSON/JSONL artifacts;
- read-only MCP access to built artifacts only;
- no execution of crawled commands or code blocks;
- context warnings for stale, weak, conflicting, or unsupported evidence;
- documented known limitations.
