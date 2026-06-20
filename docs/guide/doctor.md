# Readiness Doctor

<img class="doc-illustration" src="/brand/feature-doctor-readiness.png" alt="AgentDocs mascot beside a readiness gauge, checklist, and verified shield" />

`agentdocs doctor` audits whether documentation gives coding agents enough
evidence to perform common tasks safely.

```bash
agentdocs doctor
agentdocs doctor --min-score 80
agentdocs doctor --category task_coverage
agentdocs doctor --json
```

Checks cover discoverability, structure, task coverage, version safety, agent
safety, and runtime readiness. Findings identify inspected evidence and provide
specific recommendations.

For local and repo sources, doctor also reports `has_source_coverage`. This
check compares supported Markdown/MDX files with unsupported docs-like files in
the configured source scope, including `.rst`, likely Sphinx/reST `.txt`,
`.adoc`, and `.asciidoc`. A fail-level `unsupported_format` finding means the
build compiled only a small supported slice of a larger docs corpus, so the
readiness score should not be treated as representative until the scope is
narrowed or parser support is added.

Use `--min-score` in CI. A score below the threshold exits with code `5`.
