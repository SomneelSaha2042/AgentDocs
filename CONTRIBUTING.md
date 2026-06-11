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

## GitHub Pages

The documentation site is built with VitePress and deployed by
`.github/workflows/pages.yml`.

Repository administrators must configure the publishing source once:

1. Open **Settings > Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Run the **Deploy documentation** workflow or push a documentation change to
   `master`.

Do not select `master` and `/docs` as a branch publishing source. That setting
publishes the raw Markdown with Jekyll instead of the generated VitePress site.
Root-relative VitePress links such as `/guide/quick-start` then lose the
required `/AgentDocs/` project prefix and return 404.

Before deployment, `pnpm docs:build` verifies that generated internal links
resolve to files in `docs/.vitepress/dist`.

By contributing, you agree that your contribution is licensed under the MIT
License.
