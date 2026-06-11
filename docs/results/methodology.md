# Dogfood Methodology

The regression workflow is designed to answer two different questions:

1. Can AgentDocs compile and audit this documentation deterministically?
2. Can a coding agent safely complete a specific task using the generated
   context?

The first question is automated. The second remains an explicit human judgment.

The published findings are a snapshot captured on June 11, 2026. Live website
results can change as upstream documentation changes.

## Standard capture

Every prepared target runs:

```bash
pnpm regression:dogfood -- <target-directory>
```

The runner builds the target twice, compares generated-artifact hashes, runs
the readiness doctor, and captures the top five results for:

```txt
authentication
quickstart
error handling
```

Workflow-specific queries are repeatable:

```bash
pnpm regression:dogfood -- .dogfood/fastify \
  --name fastify-local-docs \
  --query schema-validation="schema validation" \
  --query plugin=plugin \
  --query migration=migration
```

## Recorded evidence

Each target records:

- pages collected;
- chunks generated;
- entities extracted;
- task packs generated;
- readiness score;
- broken links;
- warnings and deprecations;
- top five search results for standard and workflow-specific queries;
- first-build and repeated-build output hashes;
- explicit search-quality judgments;
- explicit `agent_task_passed` judgment;
- notes and preserved failure details.

Successful target output is written under `results/`:

```txt
results/
  build.json
  build-repeat.json
  doctor.json
  search-auth.json
  search-quickstart.json
  search-errors.json
  summary.json
  summary.csv
```

If a command fails, the runner writes `failure.json` with the command, exit
code, and captured diagnostics.

## Evaluation rules

A deterministic build is necessary, but it does not prove that the context is
correct. A readiness score is informative, but it does not prove that a
specific workflow is safe. Relevant search results are useful, but they do not
prove that an implementation task can be completed.

For that reason:

- repeated-build hashes must match;
- search quality is judged separately for standard queries;
- workflow-specific retrieval is inspected for version, framework, router, and
  runtime mixing;
- failures must preserve actionable diagnostics;
- `agent_task_passed` stays `unknown` until the specified task is completed
  using the generated context.

## Agent task criteria

The matrix includes tasks such as:

- build Hono GET and POST routes with typed validation and deploy to Cloudflare
  Workers;
- build a Fastify v5 server with JSON schema validation, a plugin, and
  structured error handling;
- implement a React mutation with invalidation using React-specific TanStack
  Query evidence only;
- build a current Next.js App Router POST route handler;
- use Supabase auth and Row Level Security without exposing secret keys.

These tasks deliberately test whether generated context respects boundaries
that matter in real implementation work.

## Interpreting the published findings

The published table separates:

- **passed regression:** automated build, audit, search capture, and repeated
  hash completed;
- **failed regression:** AgentDocs stopped and preserved diagnostics;
- **blocked preparation:** the source target could not be prepared;
- **passed agent task:** an agent completed the workflow successfully using the
  generated context;
- **unknown agent task:** the implementation task has not yet been judged.

This avoids turning a large page count or a high readiness score into a claim
the evidence does not support.

For the exact target commands and task-specific pass criteria, see the
[Dogfood Workflow Matrix](/guide/workflow-matrix). For additional bounded live
crawl examples, see [Live Dogfood Runs](/guide/live-dogfood).
