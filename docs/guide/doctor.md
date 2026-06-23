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

For local and repo sources, doctor reports `has_source_coverage`. This check compares supported source formats (Markdown, MDX, Sphinx/reST, and AsciiDoc) with other docs-like files in the configured source scope. A fail-level `unsupported_format` finding means the build compiled only a small supported slice of a larger docs corpus, indicating the scope should be adjusted.

Additionally, doctor audits include/transclusion directives for Sphinx/reST (`.. include::`) and AsciiDoc (`include::[]`):
* `has_no_include_gaps` checks if all referenced transclusion files exist and reside inside the configured source directory. A fail-level `include-out-of-scope` finding indicates that included documents are located outside the configured source root. Unresolved include paths trigger warnings or failures to prevent incomplete context assembly.

Doctor also reports `has_task_search_scope` when common task-query top results are dominated by blog, news, or release pages even though docs, tutorial, or reference evidence exists. Use `content_type` and `locale` context rules or a narrower source scope to make implementation evidence rank first.

Use `--min-score` in CI. A score below the threshold exits with code `5`.
