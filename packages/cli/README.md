# AgentDocs

**Deterministic, local-first tooling that compiles technical documentation into
an evidence-linked context layer for coding agents.**

AgentDocs turns Markdown, MDX, and public documentation websites into compact
task packs, searchable artifacts, readiness findings, and read-only MCP tools.

Start with a task-focused trial:

```bash
agentdocs try https://docs.example.com/guide --goal "implement authentication"
agentdocs context "implement authentication"
```

Website trials infer the nearest guide/product/version scope, combine sitemap
and link discovery, continue through individual page failures, and prefer
official same-origin Markdown alternatives when available.
It does not require an LLM, execute commands found in documentation, or mutate
source docs.

## Install

AgentDocs requires Node.js 20 or later and supports Windows and Linux.

```bash
npm install --global @somneelsaha/agentdocs
agentdocs --version
```

Run without installing:

```bash
npx @somneelsaha/agentdocs@beta --help
```

## Quick Start

From the repository whose docs you want to compile:

```bash
agentdocs init
agentdocs build
agentdocs doctor
agentdocs search "authentication"
```

AgentDocs generates `llms.txt`, `AGENTS.md`, task packs, a machine-readable
agent map, an offline search index, and an actionable readiness report inside
`.agentdocs/`.

## MCP

```bash
agentdocs serve-mcp
```

The MCP server provides six read-only tools and reads only validated built
artifacts. It cannot crawl, execute documentation commands, or read arbitrary
filesystem paths.

## Links

- Documentation: https://somneelsaha2042.github.io/AgentDocs/
- Source: https://github.com/SomneelSaha2042/AgentDocs
- Issues: https://github.com/SomneelSaha2042/AgentDocs/issues

MIT licensed.
