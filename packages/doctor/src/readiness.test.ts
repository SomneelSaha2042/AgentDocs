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
});
