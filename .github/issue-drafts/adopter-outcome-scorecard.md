# Add adopter outcome scorecards to public results

## Problem

The most visible result tables emphasize pages, chunks, entities, task packs,
readiness, and hash stability. These are valuable diagnostics, but adopters
care more about whether the correct evidence reached the agent, whether
wrong-version material was excluded, whether the resulting change passed tests,
and whether the workflow saved time or review effort.

## Proposed change

Add an outcome-first scorecard to the results docs and, where possible, derive
it from dogfood summary artifacts.

## Scope

- Show pipeline regression, task-context verification, and agent
  implementation as separate top-level columns.
- Move compile counts below the outcome scorecard or into detail pages.
- Add fields for routing accuracy, unsafe mixed context count, implementation
  pass/fail, and known caveats.
- Add optional fields for elapsed time, context size, and review corrections
  when benchmarks start capturing them.
- Keep historical compile metrics available for audit.

## Acceptance criteria

- A reader can tell at a glance what is proven and what is not.
- No unqualified `Passed` column appears in public benchmark tables.
- Compile metrics remain accessible but are not the primary adoption signal.
- Historical rows are preserved with clear snapshot labels.

## Notes

This issue extends the docs work already started in the Phase 5 results update.
The deeper version should reduce hand-maintained Markdown drift by checking
tables against dogfood summaries.
