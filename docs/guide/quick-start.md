# Quick Start

From the project whose documentation you want AgentDocs to compile:

```bash
agentdocs init
```

The generated configuration points at `./docs` by default. Review it, then run:

```bash
agentdocs build
agentdocs doctor
agentdocs search "authentication"
```

Inspect the most useful generated files:

```txt
.agentdocs/llms.txt
.agentdocs/AGENTS.md
.agentdocs/task-packs/
.agentdocs/reports/agent-readiness.md
```

## Crawl Public Documentation

```bash
agentdocs crawl https://docs.example.com
agentdocs build --skip-crawl
agentdocs doctor
```

The crawler stays on the configured origin by default. AgentDocs parses code
and commands as untrusted text and never executes them.
