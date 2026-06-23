import { describe, expect, it } from "vitest";

import { normalizeAsciiDoc } from "./asciidoc.js";

describe("normalizeAsciiDoc", () => {
  it("extracts title, headings, code blocks, admonitions, links, and version notes without executing includes", () => {
    const asciidoc = [
      "= Reference",
      "",
      "This is the Antora-style AsciiDoc reference page.",
      "",
      "== Setup",
      "",
      "[source,python]",
      "----",
      "import os",
      "print(os.environ.get(\"API_KEY\"))",
      "----",
      "",
      "NOTE: Read the setup page before deploying.",
      "",
      "WARNING: Do not commit secrets to the repository.",
      "",
      "IMPORTANT: Use environment variables for credentials.",
      "",
      "See xref:setup.adoc[Setup] and link:https://example.com[example].",
      "",
      "[NOTE]",
      "====",
      "Added in v5.0.",
      "",
      "Configuration overrides are now supported.",
      "====",
      "",
      "[WARNING]",
      "====",
      "Deprecated since 4.0.",
      "",
      "Use `configure()` instead of `setup()`.",
      "====",
      "",
      "include::shared.adoc[]",
    ].join("\n");

    const page = normalizeAsciiDoc({ asciidoc, repoPath: "docs/reference.adoc" });

    expect(page.title).toBe("Reference");
    expect(page.normalization.mode).toBe("asciidoc");
    expect(page.headings.map((heading) => `${heading.depth}:${heading.text}`)).toEqual([
      "1:Reference",
      "2:Setup",
    ]);
    expect(page.codeBlocks[0]).toMatchObject({
      language: "python",
      value: expect.stringContaining("print(os.environ.get(\"API_KEY\"))"),
    });
    expect(page.markdown).toContain("> [!NOTE]");
    expect(page.markdown).toContain("> [!WARNING]");
    expect(page.markdown).toContain("Added in v5.0.");
    expect(page.markdown).toContain("Deprecated since 4.0.");
    expect(page.markdown).toContain("Use `configure()` instead of `setup()`.");
    expect(page.markdown).not.toContain("include::shared.adoc[]");
    expect(page.links.map((link) => `${link.text}|${link.href}`)).toContain("Setup|setup");
    expect(page.links.map((link) => `${link.text}|${link.href}`)).toContain("example|https://example.com");
    expect(page.facets.map((facet) => `${facet.key}=${facet.value}`)).toContain("source_format=adoc");
  });

  it("does not execute code blocks or shell snippets extracted from AsciiDoc", () => {
    const asciidoc = [
      "= Commands",
      "",
      "[source,bash]",
      "----",
      "rm -rf /",
      "----",
      "",
      "....",
      "print('dangerous')",
      "....",
    ].join("\n");

    const page = normalizeAsciiDoc({ asciidoc, repoPath: "docs/commands.adoc" });

    expect(page.codeBlocks.map((block) => block.value)).toEqual([
      expect.stringContaining("rm -rf /"),
      expect.stringContaining("print('dangerous')"),
    ]);
    expect(page.markdown).toContain("rm -rf /");
  });

  it("parses .asciidoc files with source_format=asciidoc", () => {
    const asciidoc = [
      "= Setup",
      "",
      "TIP: Use a virtual environment.",
    ].join("\n");

    const page = normalizeAsciiDoc({ asciidoc, repoPath: "docs/setup.asciidoc", sourceFormat: "asciidoc" });

    expect(page.title).toBe("Setup");
    expect(page.facets.map((facet) => `${facet.key}=${facet.value}`)).toContain("source_format=asciidoc");
    expect(page.normalization.mode).toBe("asciidoc");
    expect(page.markdown).toContain("> [!TIP]");
  });

  it("produces stable IDs and content hashes across runs", () => {
    const asciidoc = "= Stable\n\nBody text.\n";
    const first = normalizeAsciiDoc({ asciidoc, repoPath: "docs/stable.adoc" });
    const second = normalizeAsciiDoc({ asciidoc, repoPath: "docs/stable.adoc" });
    expect(first).toEqual(second);
  });

  it("skips AsciiDoc attribute entries and line comments without emitting them", () => {
    const asciidoc = [
      ":toc: auto",
      ":sectnums:",
      "",
      "= Page",
      "",
      "// This is a comment.",
      "",
      "Visible paragraph.",
    ].join("\n");

    const page = normalizeAsciiDoc({ asciidoc, repoPath: "docs/page.adoc" });

    expect(page.markdown).not.toContain(":toc:");
    expect(page.markdown).not.toContain("// This is a comment.");
    expect(page.markdown).toContain("Visible paragraph.");
  });

  it("converts mailto and bare URLs deterministically", () => {
    const asciidoc = [
      "= Contact",
      "",
      "Email mailto:team@example.com[team] or visit https://example.com.",
    ].join("\n");

    const page = normalizeAsciiDoc({ asciidoc, repoPath: "docs/contact.adoc" });

    expect(page.links.map((link) => `${link.text}|${link.href}`)).toContain("team|mailto:team@example.com");
    expect(page.markdown).toContain("https://example.com");
  });
});
