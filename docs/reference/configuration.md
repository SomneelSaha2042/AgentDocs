# Configuration Reference

Create a starter file with:

```bash
agentdocs init
```

```yaml
name: Example Project
slug: example-project
version: v1

sources:
  - type: local_markdown
    path: ./docs
    include: ["**/*.md", "**/*.mdx"]
    exclude: ["**/drafts/**"]
    facets:
      runtime: node

context:
  preferred:
    version: v5
    framework: react
    locale: en
  exclusiveKeys: [version, framework, router, runtime, locale]
  rules:
    - match: "**/react/**"
      facets:
        framework: react
    - match: "**/blog/**"
      facets:
        content_type: blog

normalization:
  mdx: tolerant

freshness:
  websiteTtlHours: 24

tasks:
  - id: route-handler
    title: App Router route handler
    queries: [route handler, POST route]
    requiredFacets:
      router: app

output:
  dir: .agentdocs
  writeLlmsTxt: true
  writeAgentsMd: true
  writeTaskPacks: true
  writeMcpManifest: true

doctor:
  minScore: 80
  failOnBrokenLinks: true
  failOnMissingTaskPacks: false
```

Supported beta source types are `local_markdown`, `repo`, and `website`.
Repository sources reuse local ingestion and do not clone. Prepare repositories
containing Windows-invalid filenames on Linux or WSL. OpenAPI declarations are
recognized but fail explicitly until implemented.
Fixed source facets, matching path rules, recognized frontmatter, and
deterministic path/title extraction add evidence-linked context facets to
pages, chunks, and search results. Automatic facets include
`content_type=docs|blog|news|release|reference|tutorial|example`,
`locale=<language>`, `source_format=markdown|mdx|html`, and existing
version/framework/router/runtime values. Add `context.rules` for content type
or locale when project paths are ambiguous.
Tolerant MDX normalization is the default. It records diagnostics and uses a
line-preserving sanitizer only after strict MDX parsing fails. Set
`normalization.mdx: strict` to fail on unsupported MDX.

`freshness.websiteTtlHours` controls when crawled website sources become stale.
Local and repository sources use content hashes of configured Markdown/MDX
files instead.

For the complete contract, see
[APIS_AND_DOCUMENTATION.md](https://github.com/SomneelSaha2042/AgentDocs/blob/master/APIS_AND_DOCUMENTATION.md).
