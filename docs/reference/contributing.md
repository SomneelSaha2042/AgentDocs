# Contributing And Releases

Read the repository
[contribution guide](https://github.com/SomneelSaha2042/AgentDocs/blob/master/CONTRIBUTING.md)
before opening a pull request. Report vulnerabilities through the private
process in the
[security policy](https://github.com/SomneelSaha2042/AgentDocs/blob/master/SECURITY.md).

## Development

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm test
pnpm docs:build
pnpm pack:verify
pnpm smoke:bundle
```

CI runs the release gates on Windows and Linux with Node.js 20 and 22.

## Beta Release

1. Update the workspace and CLI versions together.
2. Run every local gate.
3. Create and push a matching version tag, such as `v0.1.0-beta.1`.
4. The release workflow verifies the package and publishes it with npm
   provenance under the `beta` dist-tag.

The npm trusted publisher must be configured for the GitHub `npm` environment
before publishing. Configure npm with GitHub user `SomneelSaha2042`, repository
`AgentDocs`, workflow `release.yml`, environment `npm`, and permission to
publish. The first publication may require a temporary granular `NPM_TOKEN`;
remove that secret after trusted publishing is active. Stable releases must not
use the beta workflow unchanged.

Enable GitHub Pages with **GitHub Actions** as the source before the first docs
deployment.
