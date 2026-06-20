# Add readiness score breakdowns and conditional labels

## Problem

The single readiness score is useful as a gate, but it is visually stronger
than its meaning. High scores can coexist with missing exact task routing,
source coverage gaps, deprecated evidence, or mixed-context warnings.

The docs now label readiness as conditional, but the product should expose why
the score is conditional without requiring users to inspect every finding.

## Proposed change

Expose category-level readiness scores, critical caps, and a short confidence
label in doctor output, dogfood summaries, and public results.

## Scope

- Add category breakdowns for discoverability, structure, task coverage,
  version safety, agent safety, runtime readiness, and source coverage where
  applicable.
- Add labels such as `clear`, `conditional`, and `blocked`.
- Report critical caveats beside the numeric score.
- Include score caps when missing source coverage or unsafe mixed context makes
  the aggregate score less representative.
- Update Markdown and JSON readiness reports.

## Acceptance criteria

- `agentdocs doctor --json` includes category scores and a readiness label.
- Public result rows can display `90/100 conditional` with the reason.
- Critical caveats are visible without opening the full report.
- Tests cover cap behavior and category totals.

## Notes

This should preserve the existing deterministic scoring model while making the
score harder to misread as agent-task success.
