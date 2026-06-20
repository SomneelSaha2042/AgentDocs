# Add task-pack routing benchmarks and publish routing accuracy

## Problem

Several dogfood findings note that exact goals need stronger task-pack routing. That quality threshold should be measured directly instead of remaining implicit in narrative findings.

## Proposed change

Extend dogfood regression to record the task pack selected for each benchmark goal and compare it with an expected target or acceptable set.

## Scope

- Add benchmark goal definitions to the dogfood runner or matrix.
- Run `agentdocs handoff` or `agentdocs verify-context` for each benchmark goal.
- Record selected task pack, fallback behavior, warnings, and context conflicts in `summary.json`.
- Add CSV/public fields for routing quality.
- Publish routing accuracy alongside readiness and repeated-build stability.
- Add confusion-style categories:
  - matched exact task;
  - matched related task;
  - fell back to generic search;
  - unsafe mixed-context.

## Acceptance criteria

- Dogfood summaries show task-pack routing results for configured benchmark goals.
- Failed or unsafe routing can fail regression when expectations are declared.
- Public docs include routing accuracy or a clearly labeled beta routing signal.
- The benchmark remains deterministic and does not require an LLM.

## Notes

This should build on existing search assertions and workflow-layer commands instead of creating a separate benchmark harness.
