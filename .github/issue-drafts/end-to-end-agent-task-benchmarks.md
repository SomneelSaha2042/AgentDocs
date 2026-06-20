# Add end-to-end agent task benchmarks

## Problem

Most public results currently prove pipeline behavior: compilation,
determinism, source coverage, context-risk detection, search captures, and
task-pack routing. They do not yet prove that coding agents complete more real
implementation tasks successfully with AgentDocs context.

`agent_task_passed` is intentionally `unknown` for most dependency workflows.
That is honest, but it leaves the most important product outcome unmeasured.

## Proposed change

Create a small benchmark suite where a coding agent must complete specific
implementation tasks using only generated AgentDocs context and local project
tests.

## Scope

- Start with existing dogfood workflows:
  - Fastify v5 route with JSON schema validation;
  - TanStack React mutation invalidation;
  - Next.js App Router POST route handler;
  - Supabase auth/RLS safety task;
  - Hono route/deployment task after quickstart routing is fixed.
- Provide minimal application fixtures with tests.
- Record whether the implementation builds, tests pass, and review finds
  wrong-version, wrong-framework, or unsafe API use.
- Save prompts, context bundle references, selected task packs, and final
  judgments.

## Acceptance criteria

- At least three tasks have recorded pass/fail outcomes.
- Public results show `Agent implementation` separately from pipeline and
  task-context verification.
- Failed implementations preserve actionable evidence.
- Benchmarks remain opt-in and do not add mandatory LLM dependencies to the
  core pipeline.

## Notes

This issue should be blocked on enough stable task routing to avoid measuring
known selector failures as if they were agent failures.
