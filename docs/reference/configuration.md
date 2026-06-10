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

Supported beta source types are `local_markdown` and `website`. OpenAPI and
repository declarations are recognized but fail explicitly until implemented.

For the complete contract, see
[APIS_AND_DOCUMENTATION.md](https://github.com/SomneelSaha2042/AgentDocs/blob/master/APIS_AND_DOCUMENTATION.md).
