# CLI Commands

| Command | Purpose |
| --- | --- |
| `agentdocs try <url-or-path> --goal <goal>` | Build, audit, and find context in one command |
| `agentdocs context <goal>` | Produce a compact agent context bundle from built artifacts |
| `agentdocs init` | Create starter configuration |
| `agentdocs ingest <path>` | Collect local Markdown and MDX |
| `agentdocs crawl <url>` | Collect same-origin website documentation |
| `agentdocs build` | Generate artifacts and search index |
| `agentdocs doctor` | Audit agent readiness |
| `agentdocs search <query>` | Search built artifacts offline |
| `agentdocs inspect entities` | Inspect extracted entities |
| `agentdocs inspect links` | Inspect extracted relationships |
| `agentdocs inspect task-pack <id>` | Explain why a task pack was generated |
| `agentdocs serve-mcp` | Start the read-only MCP server |

Global options include `--config`, `--out`, `--cwd`, `--json`, `--quiet`, and
`--verbose`.

```bash
agentdocs --help
agentdocs try ./docs --goal "implement authentication"
agentdocs build --help
```

`agentdocs export`, `build --clean`, and additional inspect targets are planned.

Task-pack inspection reads the validated `agent-map.json` and reports the
pack's confidence, required pages, source evidence, steps, and related
entities:

```bash
agentdocs inspect task-pack quickstart
agentdocs --json inspect task-pack authentication
```

`try` accepts `--include`, `--exclude`, `--max-pages`, and `--sitemap` for
scoped website trials. Direct `crawl` and `try` infer a guide scope unless
explicit include patterns are supplied.
