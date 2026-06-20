# Fixtures

Fixtures are deterministic, local inputs used by AgentDocs tests.

`basic-docs` covers Markdown and MDX, frontmatter, nested headings, fenced code blocks, relative and absolute links, install commands, imports, environment variables, an HTTP route, a version hint, a deprecated marker, and a warning admonition. It also drives deterministic chunk, graph, task-pack, manifest, `llms.txt`, and generated `AGENTS.md` integration tests.

`invalid-config.yaml` provides a deterministic invalid configuration for CLI error and exit-code checks.

`basic-site/server.mjs` serves a deterministic local HTML website and sitemap for crawler gate checks. It must only be launched by explicit test or gate commands; crawled content is never executed.

`source-coverage` covers Phase 1 coverage honesty fixtures: mostly reST with a
Markdown sliver, Django-style `.txt` reST, AsciiDoc/Antora with a README, and a
fully supported Markdown/MDX corpus. These fixtures count unsupported formats;
they do not imply parser support for reST or AsciiDoc.
