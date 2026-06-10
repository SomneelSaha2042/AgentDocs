import path from "node:path";

import {
  ReadinessReportSchema,
  type AgentMap,
  type DocPage,
  type Evidence,
  type ReadinessCategory,
  type ReadinessCheckResult,
  type ReadinessReport,
} from "@agentdocs/shared";

export type ReadinessArtifacts = {
  hasAgentMap: boolean;
  hasAgentsMd: boolean;
  hasConfig: boolean;
  hasLlmsTxt: boolean;
  hasSitemap: boolean;
  taskPackFileIds: string[];
};

export type ScanReadinessOptions = {
  agentMap?: AgentMap;
  artifacts: ReadinessArtifacts;
  category?: ReadinessCategory;
};

type CheckDefinition = Omit<ReadinessCheckResult, "scoreImpact"> & {
  weight: number;
};

const CATEGORY_WEIGHTS: Record<ReadinessCategory, number> = {
  discoverability: 20,
  structure: 20,
  task_coverage: 25,
  version_safety: 15,
  agent_safety: 10,
  runtime_readiness: 10,
};

export function scanReadiness(options: ScanReadinessOptions): ReadinessReport {
  const checks = buildChecks(options);
  const selected = options.category === undefined
    ? checks
    : checks.filter((check) => check.category === options.category);
  const available = options.category === undefined
    ? 100
    : CATEGORY_WEIGHTS[options.category];
  const awarded = selected.reduce(
    (total, check) => total + awardedPoints(check.status, check.weight),
    0,
  );
  const score = Math.round((awarded / available) * 100);
  const impactScale = 100 / available;
  return ReadinessReportSchema.parse({
    schemaVersion: "0.1.0",
    score,
    category: options.category,
    summary: {
      pass: selected.filter((check) => check.status === "pass").length,
      warn: selected.filter((check) => check.status === "warn").length,
      fail: selected.filter((check) => check.status === "fail").length,
    },
    checks: selected.map(({ weight, ...check }) => ({
      ...check,
      scoreImpact: (awardedPoints(check.status, weight) - weight) * impactScale,
      recommendation: check.status === "pass" ? undefined : check.recommendation,
    })),
  });
}

export function renderReadinessMarkdown(report: ReadinessReport): string {
  const critical = report.checks.filter((check) => check.status === "fail");
  const warnings = report.checks.filter((check) => check.status === "warn");
  const passing = report.checks.filter((check) => check.status === "pass");
  const actions = report.checks.filter(
    (check) => check.status !== "pass" && check.recommendation !== undefined,
  );
  return `# Agent-readiness report

## Score

${report.score}/100${report.category === undefined ? "" : ` (${report.category})`}

## Summary

- Passing checks: ${report.summary.pass}
- Warnings: ${report.summary.warn}
- Critical issues: ${report.summary.fail}

## Critical issues

${renderChecks(critical, "No critical issues found.")}

## Warnings

${renderChecks(warnings, "No warnings found.")}

## Passing checks

${renderChecks(passing, "No passing checks found.")}

## Recommended next actions

${actions.length === 0 ? "No immediate actions required." : actions.map((check) => `- **${check.id}**: ${check.recommendation}`).join("\n")}
`;
}

function buildChecks(options: ScanReadinessOptions): CheckDefinition[] {
  const map = options.agentMap;
  const pages = map?.pages ?? [];
  const entities = map?.entities ?? [];
  const packs = map?.taskPacks ?? [];
  const hasPages = pages.length > 0;
  const hasNavigation = options.artifacts.hasSitemap
    || pages.some((page) => page.links.some((link) => link.kind === "internal"));
  const hasPageStructure = (page: DocPage) =>
    page.headings.length > 0 || typeof page.frontmatter?.title === "string";
  const brokenLinks = findBrokenInternalLinks(pages);
  const giantPages = pages.filter((page) => page.markdown.length > 12_000);
  const evidence = (page?: DocPage): Evidence[] => page === undefined ? [] : [pageEvidence(page)];
  const entityEvidence = (pattern: RegExp): Evidence[] =>
    entities.filter((entity) => pattern.test(entity.name)).flatMap((entity) => entity.evidence);
  const packEvidence = (id: string): Evidence[] =>
    packs.find((pack) => pack.id === id)?.evidence ?? [];
  const hasInstall = entities.some(
    (entity) => entity.type === "cli_command" && /(?:install| add | add$|go get)/i.test(entity.name),
  );
  const deprecated = entities.filter(
    (entity) => entity.type === "concept" && /deprecated/i.test(entity.name),
  );
  const versions = entities.filter((entity) => entity.type === "version");
  const security = entities.filter(
    (entity) => entity.type === "concept" && /security|secret|never|expose|credential|signature/i.test(entity.name),
  );
  const envVarExamples = pages.flatMap((page) =>
    page.codeBlocks
      .filter((block) => (block.extracted?.envVars?.length ?? 0) > 0)
      .map((block): Evidence => ({
        source: "code_block",
        pageId: page.id,
        codeBlockId: block.id,
        url: page.canonicalUrl ?? page.sourceUrl,
        repoPath: page.repoPath,
        quote: block.value,
      })),
  );
  const taskPackFileIds = new Set(options.artifacts.taskPackFileIds);
  const missingTaskPackFiles = packs.filter((pack) => !taskPackFileIds.has(pack.id));
  const hasTaskPacks = packs.length > 0 && missingTaskPackFiles.length === 0;

  return [
    check("has_config", "discoverability", 5, options.artifacts.hasConfig ? "pass" : "warn",
      options.artifacts.hasConfig ? "AgentDocs config found." : "No AgentDocs config found.",
      [], "Add agentdocs.config.yaml so project identity and doctor policy are explicit."),
    check("has_pages", "discoverability", 8, pages.length > 0 ? "pass" : "fail",
      pages.length > 0 ? `${pages.length} normalized page(s) available.` : "No normalized pages are available.",
      evidence(pages[0]), 'Run "agentdocs ingest" or "agentdocs crawl", then rebuild.'),
    check("has_sitemap_or_nav", "discoverability", 7,
      hasNavigation ? "pass" : "warn",
      options.artifacts.hasSitemap
        ? "Sitemap discovery evidence found."
        : hasNavigation
          ? "Internal navigation evidence found."
        : "No sitemap or internal navigation evidence found.",
      pages.filter((page) => page.links.some((link) => link.kind === "internal")).slice(0, 3).map(pageEvidence),
      "Add a sitemap or clear internal links between canonical documentation pages."),

    check("has_titles", "structure", 4,
      pages.length > 0 && pages.every((page) => page.title.trim().length > 0) ? "pass" : "fail",
      pages.length > 0 && pages.every((page) => page.title.trim().length > 0)
        ? "All normalized pages have titles."
        : "One or more normalized pages are missing titles.",
      evidence(pages.find((page) => page.title.trim().length === 0)),
      "Add a clear title to every documentation page."),
    check("has_headings", "structure", 4,
      pages.length > 0 && pages.every(hasPageStructure) ? "pass" : "warn",
      pages.length > 0 && pages.every(hasPageStructure)
        ? "All normalized pages contain headings or frontmatter titles."
        : "One or more pages contain no headings or frontmatter title.",
      pages.filter((page) => !hasPageStructure(page)).slice(0, 5).map(pageEvidence),
      "Add a frontmatter title or split unstructured pages with descriptive headings."),
    check("has_code_blocks", "structure", 4,
      pages.some((page) => page.codeBlocks.length > 0) ? "pass" : "warn",
      pages.some((page) => page.codeBlocks.length > 0) ? "Code examples found." : "No fenced code examples found.",
      evidence(pages.find((page) => page.codeBlocks.length > 0)),
      "Add a canonical, fenced code example for the primary workflow."),
    check("has_broken_internal_links", "structure", 4, !hasPages || brokenLinks.length > 0 ? "fail" : "pass",
      !hasPages
        ? "Broken internal links cannot be checked because no pages are available."
        : brokenLinks.length === 0
          ? "No broken internal links found."
          : `${brokenLinks.length} broken internal link(s) found.`,
      brokenLinks.slice(0, 10).map(({ page, link }) => ({
        ...pageEvidence(page),
        source: "link" as const,
        headingId: link.sourceHeadingId,
        quote: link.href,
      })),
      "Fix or remove each unresolved internal documentation link."),
    check("has_giant_pages", "structure", 4, !hasPages ? "fail" : giantPages.length === 0 ? "pass" : "warn",
      !hasPages
        ? "Page size cannot be checked because no pages are available."
        : giantPages.length === 0
          ? "No pages exceed the 12,000 character guidance."
          : `${giantPages.length} page(s) exceed 12,000 characters.`,
      giantPages.slice(0, 5).map(pageEvidence),
      "Split giant pages into focused task or concept pages."),

    check("has_installation_evidence", "task_coverage", 5, hasInstall ? "pass" : "warn",
      hasInstall ? "Installation command evidence found." : "No installation command evidence found.",
      entityEvidence(/(?:install| add | add$|go get)/i), "Document a canonical installation command."),
    check("has_quickstart_candidate", "task_coverage", 5,
      packs.some((pack) => pack.id === "quickstart") ? "pass" : "warn",
      packs.some((pack) => pack.id === "quickstart") ? "Quickstart task pack found." : "No quickstart task pack candidate found.",
      packEvidence("quickstart"), "Add a concise quickstart with setup and first-use evidence."),
    check("has_auth_candidate", "task_coverage", 5,
      packs.some((pack) => pack.id === "authentication") ? "pass" : "warn",
      packs.some((pack) => pack.id === "authentication") ? "Authentication task pack found." : "No authentication task pack candidate found.",
      packEvidence("authentication"), "Document credential setup, constraints, and secret handling."),
    check("has_task_packs", "task_coverage", 10, hasTaskPacks ? "pass" : "fail",
      hasTaskPacks
        ? `${packs.length} task pack(s) generated with Markdown artifacts.`
        : packs.length > 0
          ? `${missingTaskPackFiles.length} task pack(s) in agent-map.json are missing Markdown artifacts.`
          : "No task packs were generated.",
      packs.flatMap((pack) => pack.evidence).slice(0, 10), "Add task-oriented documentation with evidence-backed steps."),

    check("has_deprecated_markers", "version_safety", 7, !hasPages || deprecated.length > 0 ? "warn" : "pass",
      !hasPages
        ? "Deprecated markers cannot be checked because no pages are available."
        : deprecated.length === 0
          ? "No deprecated markers found."
          : `${deprecated.length} deprecated marker(s) require review.`,
      deprecated.flatMap((entity) => entity.evidence), "Clearly identify replacements and current APIs near deprecated examples."),
    check("has_version_hints", "version_safety", 8, versions.length > 0 ? "pass" : "warn",
      versions.length > 0 ? "Version evidence found." : "No version evidence found.",
      versions.flatMap((entity) => entity.evidence), "Document the current supported version or version-selection guidance."),

    check("has_security_warnings", "agent_safety", 5, security.length > 0 ? "pass" : "warn",
      security.length > 0 ? "Security or secret-handling warning evidence found." : "No security or secret-handling warnings found.",
      security.flatMap((entity) => entity.evidence), "Add explicit warnings for credentials, secrets, and unsafe usage."),
    check("has_env_var_examples", "agent_safety", 5, envVarExamples.length > 0 ? "pass" : "warn",
      envVarExamples.length > 0 ? "Environment variable code examples found." : "No environment variable code examples found.",
      envVarExamples, "Document required environment variables in code blocks with non-secret placeholder values."),

    check("has_llms_txt", "runtime_readiness", 3, options.artifacts.hasLlmsTxt ? "pass" : "fail",
      options.artifacts.hasLlmsTxt ? "llms.txt found." : "llms.txt is missing.",
      [], 'Run "agentdocs build" with llms.txt generation enabled.'),
    check("has_agents_md", "runtime_readiness", 3, options.artifacts.hasAgentsMd ? "pass" : "fail",
      options.artifacts.hasAgentsMd ? "Generated AGENTS.md found." : "Generated AGENTS.md is missing.",
      [], 'Run "agentdocs build" with AGENTS.md generation enabled.'),
    check("has_agent_map", "runtime_readiness", 4, options.artifacts.hasAgentMap ? "pass" : "fail",
      options.artifacts.hasAgentMap ? "Schema-valid agent-map.json found." : "agent-map.json is missing.",
      [], 'Run "agentdocs build" to generate a schema-valid agent map.'),
  ];
}

function check(
  id: string,
  category: ReadinessCategory,
  weight: number,
  status: ReadinessCheckResult["status"],
  message: string,
  evidence: Evidence[],
  recommendation: string,
): CheckDefinition {
  return { id, category, weight, status, message, evidence: stableEvidence(evidence), recommendation };
}

function awardedPoints(status: ReadinessCheckResult["status"], weight: number): number {
  return status === "pass" ? weight : status === "warn" ? weight / 2 : 0;
}

function findBrokenInternalLinks(pages: DocPage[]) {
  const references = new Set(
    pages.flatMap((page) => [page.canonicalUrl, page.sourceUrl, page.repoPath])
      .filter((value): value is string => value !== undefined)
      .flatMap(referenceAliases),
  );
  return pages.flatMap((page) =>
    page.links
      .filter((link) => link.kind === "internal")
      .filter((link) => link.isBroken === true || !references.has(normalizeReference(link.resolvedHref ?? link.href)))
      .map((link) => ({ page, link })),
  );
}

function normalizeReference(value: string): string {
  const withoutHash = value.split("#", 1)[0] ?? value;
  const normalized = withoutHash.includes("://") ? withoutHash : path.posix.normalize(withoutHash);
  return normalized.length > 1 ? normalized.replace(/\/+$/, "") : normalized;
}

function referenceAliases(value: string): string[] {
  const normalized = normalizeReference(value);
  if (normalized.includes("://")) {
    return [normalized];
  }
  const withoutMarkdownExtension = normalized.replace(/\.(?:md|mdx)$/i, "");
  const withoutIndex = withoutMarkdownExtension.replace(/\/index$/i, "");
  return [...new Set([normalized, withoutMarkdownExtension, withoutIndex])];
}

function pageEvidence(page: DocPage): Evidence {
  return {
    source: "page",
    pageId: page.id,
    url: page.canonicalUrl ?? page.sourceUrl,
    repoPath: page.repoPath,
  };
}

function renderChecks(checks: ReadinessCheckResult[], fallback: string): string {
  if (checks.length === 0) {
    return fallback;
  }
  return checks.map((check) => {
    const impact = check.scoreImpact === 0 ? "" : ` (${check.scoreImpact} points)`;
    const sources = check.evidence
      .map((item) => item.url ?? item.repoPath ?? item.pageId)
      .filter((value): value is string => value !== undefined);
    return `- **${check.id}**${impact}: ${check.message}${sources.length === 0 ? "" : ` Evidence: ${[...new Set(sources)].join(", ")}.`}`;
  }).join("\n");
}

function stableEvidence(evidence: Evidence[]): Evidence[] {
  const unique = new Map(evidence.map((item) => [JSON.stringify(item), item]));
  return [...unique.values()].sort((left, right) => compareStrings(JSON.stringify(left), JSON.stringify(right)));
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
