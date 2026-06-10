# Fixtures

Fixtures are deterministic, local inputs used by AgentDocs tests.

`basic-docs` currently covers Markdown and MDX, frontmatter, nested directories and headings, fenced code blocks, relative and absolute links, an install command, and an environment variable. Later phases will add focused fixtures for the remaining extraction and integration contracts.

`invalid-config.yaml` provides a deterministic invalid configuration for CLI error and exit-code checks.

`basic-site/server.mjs` serves a deterministic local HTML website and sitemap for crawler gate checks. It must only be launched by explicit test or gate commands; crawled content is never executed.
