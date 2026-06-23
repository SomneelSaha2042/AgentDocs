import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildAgentMap } from "@agentdocs/graph";
import { chunkMarkdownByHeading } from "@agentdocs/normalizer";
import { normalizeMarkdown } from "@agentdocs/normalizer";
import { generateStaticArtifacts } from "@agentdocs/generator";
import { describe, expect, it } from "vitest";

import { renderReadinessMarkdown, scanReadiness } from "./readiness.js";

describe("scanReadiness", () => {
  it("produces deterministic actionable checks with evidence", async () => {
    const fixture = path.resolve(import.meta.dirname, "../../../fixtures/basic-docs/guides/setup.md");
    const page = normalizeMarkdown({
      markdown: await readFile(fixture, "utf8"),
      repoPath: "guides/setup.md",
    });
    const map = buildAgentMap({
      pages: [page],
      chunks: chunkMarkdownByHeading(page),
    });
    const generated = generateStaticArtifacts({
      agentMap: map,
      project: { name: "Fixture", slug: "fixture" },
    });
    const report = scanReadiness({
      agentMap: generated.agentMap,
      artifacts: {
        hasAgentMap: true,
        hasAgentsMd: true,
        hasConfig: false,
        hasLlmsTxt: true,
        hasSitemap: false,
        taskPackFileIds: generated.taskPacks.map((pack) => pack.id),
      },
    });

    expect(report.score).toBeGreaterThan(0);
    expect(report.score).toBeLessThan(100);
    expect(report.checks.some((check) => check.status === "warn")).toBe(true);
    expect(report.checks.find((check) => check.id === "has_config")?.recommendation)
      .toContain("agentdocs.config.yaml");
    expect(report.checks.find((check) => check.id === "has_version_hints")?.evidence.length)
      .toBeGreaterThan(0);
    expect(renderReadinessMarkdown(report)).toContain("## Recommended next actions");
    expect(scanReadiness({
      agentMap: generated.agentMap,
      artifacts: {
        hasAgentMap: true,
        hasAgentsMd: true,
        hasConfig: false,
        hasLlmsTxt: true,
        hasSitemap: false,
        taskPackFileIds: generated.taskPacks.map((pack) => pack.id),
      },
    })).toEqual(report);
  });

  it("normalizes category-only scores", () => {
    const report = scanReadiness({
      category: "runtime_readiness",
      artifacts: {
        hasAgentMap: false,
        hasAgentsMd: false,
        hasConfig: false,
        hasLlmsTxt: false,
        hasSitemap: false,
        taskPackFileIds: [],
      },
    });

    expect(report.score).toBe(0);
    expect(report.checks.every((check) => check.category === "runtime_readiness")).toBe(true);
    expect(report.checks.reduce((total, check) => total + check.scoreImpact, 0)).toBe(-100);
  });

  it("fails unresolved internal links with source evidence", () => {
    const page = normalizeMarkdown({
      markdown: "# Guide\n\nRead the [missing page](missing.md).\n",
      repoPath: "guide.md",
    });
    page.links[0]!.isBroken = true;
    const report = scanReadiness({
      agentMap: buildAgentMap({
        pages: [page],
        chunks: chunkMarkdownByHeading(page),
      }),
      artifacts: {
        hasAgentMap: true,
        hasAgentsMd: false,
        hasConfig: false,
        hasLlmsTxt: false,
        hasSitemap: false,
        taskPackFileIds: [],
      },
    });
    const brokenLinks = report.checks.find((check) => check.id === "has_broken_internal_links");

    expect(brokenLinks?.status).toBe("fail");
    expect(brokenLinks?.evidence[0]?.quote).toBe("missing.md");
  });

  it("fails internal links with unresolved heading fragments", () => {
    const guide = normalizeMarkdown({
      markdown: "# Guide\n\nRead [setup auth](setup.md#missing-auth) and [local details](#missing-local).\n",
      repoPath: "guide.md",
    });
    const setup = normalizeMarkdown({
      markdown: "# Setup\n\n## Configure auth\n",
      repoPath: "setup.md",
    });
    const report = scanReadiness({
      agentMap: buildAgentMap({
        pages: [guide, setup],
        chunks: [...chunkMarkdownByHeading(guide), ...chunkMarkdownByHeading(setup)],
      }),
      artifacts: {
        hasAgentMap: true,
        hasAgentsMd: false,
        hasConfig: false,
        hasLlmsTxt: false,
        hasSitemap: false,
        taskPackFileIds: [],
      },
    });
    const brokenLinks = report.checks.find((check) => check.id === "has_broken_internal_links");

    expect(brokenLinks?.status).toBe("fail");
    expect(brokenLinks?.message).toBe("2 broken internal link(s) found.");
    expect(brokenLinks?.evidence.map((item) => item.quote)).toEqual([
      "#missing-local",
      "setup.md#missing-auth",
    ]);
  });

  it("accepts generated heading fragments for duplicate and punctuation-heavy headings", () => {
    const page = normalizeMarkdown({
      markdown: [
        "# Guide",
        "",
        "See [first](#configure-auth), [second](#configure-auth-1), and [punctuation](#does-it-work).",
        "",
        "## Configure auth",
        "",
        "## Configure auth",
        "",
        "## Does it work?",
        "",
      ].join("\n"),
      repoPath: "guide.md",
    });
    const report = scanReadiness({
      agentMap: buildAgentMap({ pages: [page], chunks: chunkMarkdownByHeading(page) }),
      artifacts: {
        hasAgentMap: true,
        hasAgentsMd: false,
        hasConfig: false,
        hasLlmsTxt: false,
        hasSitemap: false,
        taskPackFileIds: [],
      },
    });

    expect(report.checks.find((check) => check.id === "has_broken_internal_links")?.status)
      .toBe("pass");
  });

  it("does not award vacuous passes when no pages can be inspected", () => {
    const report = scanReadiness({
      artifacts: {
        hasAgentMap: false,
        hasAgentsMd: false,
        hasConfig: false,
        hasLlmsTxt: false,
        hasSitemap: false,
        taskPackFileIds: [],
      },
    });

    expect(report.checks.find((check) => check.id === "has_broken_internal_links")?.status)
      .toBe("fail");
    expect(report.checks.find((check) => check.id === "has_giant_pages")?.status)
      .toBe("fail");
    expect(report.checks.find((check) => check.id === "has_deprecated_markers")?.status)
      .toBe("warn");
  });

  it("requires static task packs and code-backed environment examples", () => {
    const page = normalizeMarkdown({
      markdown: "# Setup\n\nSet EXAMPLE_API_KEY before starting.\n",
      repoPath: "setup.md",
    });
    const generated = generateStaticArtifacts({
      agentMap: buildAgentMap({
        pages: [page],
        chunks: chunkMarkdownByHeading(page),
      }),
      project: { name: "Fixture", slug: "fixture" },
    });
    const report = scanReadiness({
      agentMap: generated.agentMap,
      artifacts: {
        hasAgentMap: true,
        hasAgentsMd: true,
        hasConfig: true,
        hasLlmsTxt: true,
        hasSitemap: false,
        taskPackFileIds: [],
      },
    });

    expect(report.checks.find((check) => check.id === "has_task_packs")?.status)
      .toBe("fail");
    expect(report.checks.find((check) => check.id === "has_env_var_examples")?.status)
      .toBe("warn");
  });

  it("accepts sitemap discovery without internal navigation links", () => {
    const report = scanReadiness({
      artifacts: {
        hasAgentMap: false,
        hasAgentsMd: false,
        hasConfig: false,
        hasLlmsTxt: false,
        hasSitemap: true,
        taskPackFileIds: [],
      },
    });

    expect(report.checks.find((check) => check.id === "has_sitemap_or_nav"))
      .toMatchObject({ status: "pass", message: "Sitemap discovery evidence found." });
  });

  it("does not call uncollected links broken and caps poor extraction readiness", () => {
    const page = normalizeMarkdown({
      markdown: "# Guide\n\nRead the [other page](other.md).\n",
      repoPath: "guide.md",
    });
    const report = scanReadiness({
      agentMap: buildAgentMap({ pages: [page], chunks: chunkMarkdownByHeading(page) }),
      artifacts: {
        hasAgentMap: true,
        hasAgentsMd: true,
        hasConfig: true,
        hasLlmsTxt: true,
        hasSitemap: true,
        taskPackFileIds: [],
        usablePages: 1,
        unusablePages: 4,
      },
    });

    expect(report.checks.find((check) => check.id === "has_broken_internal_links")?.status)
      .toBe("pass");
    expect(report.checks.find((check) => check.id === "has_link_coverage")?.status)
      .toBe("warn");
    expect(report.checks.find((check) => check.id === "has_extraction_quality")?.status)
      .toBe("warn");
    expect(report.score).toBeLessThanOrEqual(60);
  });

  it("fails source coverage when unsupported docs formats dominate the intended scope", () => {
    const page = normalizeMarkdown({
      markdown: "# Tiny Markdown Sliver\n\nThis page is not representative.\n",
      repoPath: "README.md",
    });
    const report = scanReadiness({
      agentMap: buildAgentMap({ pages: [page], chunks: chunkMarkdownByHeading(page) }),
      artifacts: {
        hasAgentMap: true,
        hasAgentsMd: true,
        hasConfig: true,
        hasLlmsTxt: true,
        hasSitemap: false,
        taskPackFileIds: [],
        sourceCoverage: {
          supportedFiles: 1,
          unsupportedFiles: 20,
          intendedFiles: 21,
          compiledFiles: 1,
          degradedFiles: 0,
          skippedFiles: 0,
          failedFiles: 0,
          coverageRatio: 0.0476,
          supportedByFormat: { markdown: 1, mdx: 0, rst: 0, restText: 0, adoc: 0, asciidoc: 0 },
          unsupportedByFormat: { rst: 18, restText: 2, adoc: 0, asciidoc: 0 },
          gapSeverity: "fail",
          gapReason: "unsupported_format",
          message: "1 of 21 docs-like file(s) compiled; 20 unsupported file(s) were in scope.",
        },
      },
    });
    const coverage = report.checks.find((check) => check.id === "has_source_coverage");

    expect(coverage).toMatchObject({
      status: "fail",
      message: "1 of 21 docs-like file(s) compiled; 20 unsupported file(s) were in scope.",
    });
    expect(coverage?.evidence[0]?.quote).toContain("unsupported=20");
    expect(report.score).toBeLessThanOrEqual(49);
  });

  it("warns when task-query results are dominated by news and release pages", () => {
    const pages = [
      normalizeMarkdown({
        markdown: "# Workflow release notes\n\nWorkflow workflow workflow update.\n",
        repoPath: "releases/workflow.md",
      }),
      normalizeMarkdown({
        markdown: "# Workflow news\n\nWorkflow workflow announcement.\n",
        repoPath: "news/workflow.md",
      }),
      normalizeMarkdown({
        markdown: "# Workflow blog\n\nWorkflow workflow story.\n",
        repoPath: "blog/workflow.md",
      }),
      normalizeMarkdown({
        markdown: "# Workflow tutorial\n\nCreate and configure a workflow.\n",
        repoPath: "docs/tutorials/workflow.md",
      }),
    ];
    const report = scanReadiness({
      agentMap: buildAgentMap({
        pages,
        chunks: pages.flatMap((page) => chunkMarkdownByHeading(page)),
      }),
      artifacts: {
        hasAgentMap: true,
        hasAgentsMd: true,
        hasConfig: true,
        hasLlmsTxt: true,
        hasSitemap: false,
        taskPackFileIds: [],
      },
    });

    expect(report.checks.find((check) => check.id === "has_task_search_scope"))
      .toMatchObject({
        status: "warn",
        message: "1 task query is dominated by news, blog, or release pages despite implementation docs evidence.",
      });
  });

  it("caps unavoidable mixed exclusive task context and fails missing configured tasks", () => {
    const v3 = normalizeMarkdown({
      markdown: "---\nversion: v3\n---\n# Migration\n\nUpgrade the schema.\n\n```js\nmigrate()\n```\n",
      repoPath: "v3/migration.md",
    });
    const v5 = normalizeMarkdown({
      markdown: "---\nversion: v5\n---\n# Migration\n\nUpgrade the schema.\n",
      repoPath: "v5/migration.md",
    });
    const mixed = { ...v3, facets: [...v3.facets, ...v5.facets] };
    const generated = generateStaticArtifacts({
      agentMap: buildAgentMap({
        pages: [mixed],
        chunks: chunkMarkdownByHeading(mixed),
      }),
      project: { name: "Fixture", slug: "fixture" },
      exclusiveKeys: ["version"],
    });
    const report = scanReadiness({
      agentMap: generated.agentMap,
      artifacts: {
        hasAgentMap: true,
        hasAgentsMd: true,
        hasConfig: true,
        hasLlmsTxt: true,
        hasSitemap: false,
        taskPackFileIds: generated.taskPacks.map((pack) => pack.id),
        expectedTaskIds: ["route-handler"],
      },
    });

    expect(generated.taskPacks.find((pack) => pack.id === "migration")?.context.conflicts[0])
      .toMatchObject({ key: "version", values: ["v3", "v5"] });
    expect(report.checks.find((check) => check.id === "has_context_consistency")?.status)
      .toBe("fail");
    expect(report.checks.find((check) => check.id === "has_expected_task_coverage")?.status)
      .toBe("fail");
    expect(report.score).toBeLessThanOrEqual(69);
  });

  it("evaluates include gaps correctly", () => {
    const reportPass = scanReadiness({
      artifacts: {
        hasAgentMap: false,
        hasAgentsMd: false,
        hasConfig: false,
        hasLlmsTxt: false,
        hasSitemap: false,
        taskPackFileIds: [],
        includeGaps: [],
      },
    });
    expect(reportPass.checks.find((check) => check.id === "has_no_include_gaps")?.status).toBe("pass");

    const reportWarn = scanReadiness({
      artifacts: {
        hasAgentMap: false,
        hasAgentsMd: false,
        hasConfig: false,
        hasLlmsTxt: false,
        hasSitemap: false,
        taskPackFileIds: [],
        includeGaps: [{ repoPath: "index.rst", target: "missing.rst", reason: "include-missing" }],
      },
    });
    expect(reportWarn.checks.find((check) => check.id === "has_no_include_gaps")?.status).toBe("warn");

    const reportFail = scanReadiness({
      artifacts: {
        hasAgentMap: false,
        hasAgentsMd: false,
        hasConfig: false,
        hasLlmsTxt: false,
        hasSitemap: false,
        taskPackFileIds: [],
        includeGaps: [{ repoPath: "index.rst", target: "/etc/passwd", reason: "include-out-of-scope" }],
      },
    });
    expect(reportFail.checks.find((check) => check.id === "has_no_include_gaps")?.status).toBe("fail");
  });
});
