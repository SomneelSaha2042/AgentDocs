import { describe, expect, it } from "vitest";

import { normalizeRest } from "./rest.js";

describe("normalizeRest", () => {
  it("extracts title, headings, code blocks, admonitions, links, and version notes without executing directives", () => {
    const rest = [
      "Guide",
      "=====",
      "",
      "Intro paragraph.",
      "",
      "First Section",
      "-------------",
      "",
      "See `tutorial <tutorial.html>`_ and :doc:`guide`.",
      "",
      ".. code-block:: python",
      "",
      "   import os",
      "   print(os.environ.get(\"API_KEY\"))",
      "",
      ".. note::",
      "",
      "   Read the tutorial before deploying.",
      "",
      ".. warning::",
      "",
      "   Do not commit secrets.",
      "",
      ".. versionadded:: 5.0",
      "",
      "   Configuration overrides are now supported.",
      "",
      ".. deprecated:: 4.0",
      "",
      "   Use ``configure()`` instead of ``setup()``.",
      "",
      ".. include:: unrelated.rst",
      "",
      ".. toctree::",
      "",
      "   tutorial",
    ].join("\n");

    const page = normalizeRest({ rest, repoPath: "docs/guide.rst" });

    expect(page.title).toBe("Guide");
    expect(page.sourceType).toBe("local_markdown");
    expect(page.normalization.mode).toBe("rest");
    expect(page.headings.map((heading) => `${heading.depth}:${heading.text}`)).toEqual([
      "1:Guide",
      "2:First Section",
    ]);
    expect(page.codeBlocks[0]).toMatchObject({
      language: "python",
      value: expect.stringContaining("print(os.environ.get(\"API_KEY\"))"),
    });
    expect(page.markdown).toContain("> [!NOTE]");
    expect(page.markdown).toContain("> [!WARNING]");
    expect(page.markdown).toContain("**Added in v5.0:**");
    expect(page.markdown).toContain("**Deprecated since v4.0:**");
    expect(page.markdown).toContain("Use `configure()` instead of `setup()`.");
    expect(page.markdown).not.toContain(".. include::");
    expect(page.markdown).not.toContain(".. toctree::");
    expect(page.links.map((link) => `${link.text}|${link.href}`)).toContain("tutorial|tutorial.html");
    expect(page.links.map((link) => `${link.text}|${link.href}`)).toContain("guide|guide");
    expect(page.facets.map((facet) => `${facet.key}=${facet.value}`)).toContain("source_format=rst");
  });

  it("does not execute code blocks or shell snippets extracted from reST", () => {
    const rest = [
      "Commands",
      "=========",
      "",
      ".. code-block:: bash",
      "",
      "   rm -rf /",
      "",
      "::",
      "",
      "   print('dangerous')",
    ].join("\n");

    const page = normalizeRest({ rest, repoPath: "docs/commands.rst" });

    expect(page.codeBlocks.map((block) => block.value)).toEqual([
      expect.stringContaining("rm -rf /"),
      expect.stringContaining("print('dangerous')"),
    ]);
    expect(page.markdown).toContain("rm -rf /");
  });

  it("parses Django-style .txt reST with source_format=restText", () => {
    const rest = [
      "Introduction",
      "============",
      "",
      ".. note::",
      "",
      "   Django stores reST in .txt files.",
    ].join("\n");

    const page = normalizeRest({ rest, repoPath: "docs/intro.txt", sourceFormat: "restText" });

    expect(page.title).toBe("Introduction");
    expect(page.facets.map((facet) => `${facet.key}=${facet.value}`)).toContain("source_format=restText");
    expect(page.normalization.mode).toBe("rest");
    expect(page.markdown).toContain("> [!NOTE]");
  });

  it("produces stable IDs and content hashes across runs", () => {
    const rest = "Stable\n======\n\nBody text.\n";
    const first = normalizeRest({ rest, repoPath: "docs/stable.rst" });
    const second = normalizeRest({ rest, repoPath: "docs/stable.rst" });
    expect(first).toEqual(second);
  });

  it("handles overline-style section headings deterministically", () => {
    const rest = [
      "#####",
      "Part",
      "#####",
      "",
      "Section",
      "=======",
    ].join("\n");

    const page = normalizeRest({ rest, repoPath: "docs/part.rst" });

    expect(page.headings.map((heading) => `${heading.depth}:${heading.text}`)).toEqual([
      "1:Part",
      "2:Section",
    ]);
  });

  it("ignores unknown directives and keeps surrounding prose", () => {
    const rest = [
      "Page",
      "====",
      "",
      ".. autoclass:: module.Class",
      "   :members:",
      "",
      "Visible paragraph.",
    ].join("\n");

    const page = normalizeRest({ rest, repoPath: "docs/page.rst" });

    expect(page.markdown).not.toContain(".. autoclass::");
    expect(page.markdown).toContain("Visible paragraph.");
  });
});
