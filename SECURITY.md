# Security Policy

## Reporting a Vulnerability

Do not open a public issue for a vulnerability that could expose user data,
escape configured output directories, execute documentation content, or allow
arbitrary filesystem access.

Report vulnerabilities privately through GitHub Security Advisories for:

https://github.com/SomneelSaha2042/AgentDocs/security/advisories/new

Include affected versions, reproduction steps, impact, and any suggested fix.
You should receive an initial response within seven days.

## Supported Versions

During beta, security fixes are provided for the latest published beta only.

The VitePress documentation development server is bound to `127.0.0.1`.
Do not expose it to untrusted networks.

## Security Boundaries

AgentDocs treats documentation, HTML, code blocks, configuration, and MCP
arguments as untrusted input. It must not execute commands found in docs, write
outside configured output directories, or expose arbitrary filesystem reads
through MCP.

For v1, the mandatory security boundaries are:

- crawled or ingested docs are parsed as data and never executed;
- generated setup commands are suggestions only and are not run by AgentDocs;
- output paths must stay inside the configured output directory;
- export destinations must not be the active output directory or a child of it;
- MCP tools may read built AgentDocs artifacts only;
- MCP resource and tool arguments must be validated before filesystem access;
- MCP tool allowlists must be enforced when tools are called, not only when
  listing tools;
- network access happens only during explicit crawl/try operations or other
  user-requested collection steps.
