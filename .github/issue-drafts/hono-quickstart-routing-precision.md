# Fix Hono quickstart task-pack routing precision

## Problem

The Phase 5 full dogfood rerun showed that Hono quickstart routing still misses
even though the build succeeds and a quickstart task pack exists.

Observed results:

- Hono local docs: `create a Hono app` selected `installation` instead of
  `quickstart`.
- Hono prepared crawl: `create a Hono app` selected `authentication` instead
  of `quickstart`.

This is a selector precision issue, not a collection failure.

## Proposed change

Improve task-pack selection so creation/setup goals prefer canonical
quickstart evidence over adjacent installation or authentication packs when
both are present.

## Scope

- Add a focused regression fixture or dogfood expectation for `create a Hono
  app`.
- Inspect task-pack search text and scoring for `quickstart`, `installation`,
  and `authentication`.
- Prefer evidence from headings/titles such as `Getting Started`,
  `Quickstart`, `Create`, and documented app creation commands.
- Avoid weakening valid installation routing for install-only goals.

## Acceptance criteria

- Hono local `create a Hono app` routes to `quickstart`.
- Hono prepared crawl `create a Hono app` routes to `quickstart`.
- Existing installation, authentication, and deployment routing tests remain
  green.
- The fix is deterministic and does not require an LLM.

## Notes

This issue came directly from the full dogfood rerun after Phase 5 routing
improvements.
