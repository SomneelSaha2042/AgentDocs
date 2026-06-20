# Finish heading-fragment and anchor slug validation coverage in doctor

## Problem

Doctor now validates generated heading fragments for collected pages, but custom HTML anchors and framework-specific manual anchors can still require review. Source traceability loses value when links land on the wrong section, so fragment correctness should keep getting stronger.

## Current state

The core doctor check validates same-page and cross-page `#fragment` links against collected generated headings. Regression coverage includes missing fragments, duplicate heading suffixes, and punctuation-heavy heading slugs.

## Proposed change

Extend fragment validation coverage and make the supported slug behavior explicit.

## Scope

- Document supported slug normalization rules.
- Add regression fixtures for additional site-generator behavior where deterministic evidence exists.
- Investigate MDX/custom-anchor extraction without executing or trusting source code.
- Consider exposing fragment failures through `agentdocs inspect broken-links`.
- Preserve the current behavior that out-of-scope or uncollected internal pages are link-coverage warnings rather than broken-link failures.

## Acceptance criteria

- Docs distinguish generated heading fragments from custom/manual anchors.
- Fixtures cover duplicate headings, punctuation-heavy headings, nested headings, and at least one MDX/manual-anchor case if supported.
- Doctor findings include actionable evidence for broken fragments.
- No source docs or code blocks are executed.

## Notes

This is a follow-up to the initial doctor implementation rather than a rewrite.
