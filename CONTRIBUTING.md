# Contributing to AgentDocs

AgentDocs welcomes bug reports, documentation improvements, fixtures, and
focused implementation changes.

Before changing code, read [AGENTS.md](AGENTS.md), [PRD.md](PRD.md), and
[BUILD_PLAN.md](BUILD_PLAN.md). Keep the core deterministic, local-first,
evidence-linked, and safe for untrusted documentation input.

## Development

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm audit:high
pnpm build
pnpm typecheck
pnpm test
pnpm docs:build
pnpm pack:verify
pnpm smoke:bundle
```

Add focused tests for behavioral changes. Do not make network calls in tests
unless they are explicitly marked integration tests and skipped by default.

## Pull Requests

Describe the behavior changed, tests added, known limitations, and any public
documentation updates. Keep unrelated refactors out of focused changes.

By contributing, you agree that your contribution is licensed under the MIT
License.
