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
