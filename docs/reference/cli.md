# CLI Commands

| Command | Purpose |
| --- | --- |
| `agentdocs init` | Create starter configuration |
| `agentdocs ingest <path>` | Collect local Markdown and MDX |
| `agentdocs crawl <url>` | Collect same-origin website documentation |
| `agentdocs build` | Generate artifacts and search index |
| `agentdocs doctor` | Audit agent readiness |
| `agentdocs search <query>` | Search built artifacts offline |
| `agentdocs inspect entities` | Inspect extracted entities |
| `agentdocs inspect links` | Inspect extracted relationships |
| `agentdocs serve-mcp` | Start the read-only MCP server |

Global options include `--config`, `--out`, `--cwd`, `--json`, `--quiet`, and
`--verbose`.

```bash
agentdocs --help
agentdocs build --help
```

`agentdocs export`, `build --clean`, and additional inspect targets are planned.
