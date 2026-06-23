import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { resolveIncludes } from "./includes.js";

async function withTempTree(build: (root: string) => Promise<void>, fn: (root: string) => Promise<void>) {
  const root = await mkdtemp(path.join(os.tmpdir(), "agentdocs-includes-"));
  try {
    await build(root);
    await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

describe("resolveIncludes", () => {
  it("resolves an in-scope reST include and splices the authored target prose", async () => {
    await withTempTree(
      async (root) => {
        await writeFile(path.join(root, "shell.rst"), "Title\n=====\n\n.. include:: target.rst\n\nTrailing.\n");
        await writeFile(path.join(root, "target.rst"), "Target Heading\n==============\n\nIncluded prose.\n");
      },
      async (root) => {
        const r = await resolveIncludes({
          content: "Title\n=====\n\n.. include:: target.rst\n\nTrailing.\n",
          filePath: path.join(root, "shell.rst"),
          sourceRoot: root,
          format: "rst",
        });
        expect(r.resolvedTargets).toEqual(["target.rst"]);
        expect(r.unresolved).toEqual([]);
        expect(r.content).toContain("Included prose.");
        expect(r.content).toContain("Target Heading");
        expect(r.content).toContain("Trailing.");
        expect(r.content).not.toContain(".. include:: target.rst");
      },
    );
  });

  it("resolves a leading-slash-rooted reST include that traverses back into the source root", async () => {
    await withTempTree(
      async (root) => {
        await mkdir(path.join(root, "docs", "sub"), { recursive: true });
        await mkdir(path.join(root, "shared"), { recursive: true });
        await writeFile(path.join(root, "docs", "sub", "shell.rst"), ".. include:: /../../shared/inc.rst\n");
        await writeFile(path.join(root, "shared", "inc.rst"), "Recovering upstream prose.\n");
      },
      async (root) => {
        const r = await resolveIncludes({
          content: ".. include:: /../../shared/inc.rst\n",
          filePath: path.join(root, "docs", "sub", "shell.rst"),
          sourceRoot: root,
          format: "rst",
        });
        expect(r.resolvedTargets).toEqual(["shared/inc.rst"]);
        expect(r.content).toContain("Recovering upstream prose.");
      },
    );
  });

  it("rejects an out-of-scope include and leaves the directive for classification", async () => {
    await withTempTree(
      async (root) => {
        await mkdir(path.join(root, "docs"), { recursive: true });
        await writeFile(path.join(root, "docs", "shell.rst"), ".. include:: /../../../etc/secret\n");
      },
      async (root) => {
        const r = await resolveIncludes({
          content: ".. include:: /../../../etc/secret\n",
          filePath: path.join(root, "docs", "shell.rst"),
          sourceRoot: root,
          format: "rst",
        });
        expect(r.resolvedTargets).toEqual([]);
        expect(r.unresolved.map((u) => u.reason)).toContain("out-of-scope");
        expect(r.content).toContain(".. include:: /../../../etc/secret");
      },
    );
  });

  it("records a missing target without throwing", async () => {
    await withTempTree(
      async (root) => {
        await writeFile(path.join(root, "shell.rst"), ".. include:: ghost.rst\n");
      },
      async (root) => {
        const r = await resolveIncludes({
          content: ".. include:: ghost.rst\n",
          filePath: path.join(root, "shell.rst"),
          sourceRoot: root,
          format: "rst",
        });
        expect(r.unresolved.map((u) => u.reason)).toContain("missing");
        expect(r.content).toContain(".. include:: ghost.rst");
      },
    );
  });

  it("detects include cycles and terminates", async () => {
    await withTempTree(
      async (root) => {
        await writeFile(path.join(root, "a.rst"), "A\n=\n\n.. include:: b.rst\n");
        await writeFile(path.join(root, "b.rst"), "B\n=\n\n.. include:: a.rst\n");
      },
      async (root) => {
        const r = await resolveIncludes({
          content: "A\n=\n\n.. include:: b.rst\n",
          filePath: path.join(root, "a.rst"),
          sourceRoot: root,
          format: "rst",
        });
        expect(r.unresolved.map((u) => u.reason)).toContain("cycle");
        expect(r.content).toContain("A");
        expect(r.content).toContain("B");
      },
    );
  });

  it("rejects targets in a foreign format family", async () => {
    await withTempTree(
      async (root) => {
        await writeFile(path.join(root, "shell.rst"), ".. include:: snippet.py\n");
      },
      async (root) => {
        const r = await resolveIncludes({
          content: ".. include:: snippet.py\n",
          filePath: path.join(root, "shell.rst"),
          sourceRoot: root,
          format: "rst",
        });
        expect(r.unresolved.map((u) => u.reason)).toContain("unsupported-format");
      },
    );
  });

  it("skips Antora resource-id includes without resolving", async () => {
    await withTempTree(
      async (root) => {
        await writeFile(path.join(root, "shell.adoc"), "= Title\n\ninclude::partial$snippet.adoc[]\n");
      },
      async (root) => {
        const r = await resolveIncludes({
          content: "include::partial$snippet.adoc[]\n",
          filePath: path.join(root, "shell.adoc"),
          sourceRoot: root,
          format: "adoc",
        });
        expect(r.unresolved.map((u) => u.reason)).toContain("antora-id");
        expect(r.content).toContain("include::partial$snippet.adoc[]");
      },
    );
  });

  it("resolves an in-scope AsciiDoc include", async () => {
    await withTempTree(
      async (root) => {
        await writeFile(path.join(root, "shell.adoc"), "= Title\n\ninclude::target.adoc[]\n");
        await writeFile(path.join(root, "target.adoc"), "= Target\n\nIncluded.\n");
      },
      async (root) => {
        const r = await resolveIncludes({
          content: "= Title\n\ninclude::target.adoc[]\n",
          filePath: path.join(root, "shell.adoc"),
          sourceRoot: root,
          format: "adoc",
        });
        expect(r.resolvedTargets).toEqual(["target.adoc"]);
        expect(r.content).toContain("Included.");
      },
    );
  });
});