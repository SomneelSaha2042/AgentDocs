import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  AgentMapSchema,
  AGENTDOCS_PACKAGE_NAME,
  ConfigValidationError,
  parseConfig,
} from "./index.js";

describe("@agentdocs/shared", () => {
  it("exposes the package placeholder", () => {
    expect(AGENTDOCS_PACKAGE_NAME).toBe("AgentDocs");
  });

  it("upgrades 0.1.0 artifacts with missing facets in memory", async () => {
    const file = path.resolve(import.meta.dirname, "../../../fixtures/hardening/old-0.1-agent-map.json");
    const map = AgentMapSchema.parse(JSON.parse(await readFile(file, "utf8")));

    expect(map.schemaVersion).toBe("0.2.0");
    expect(map.pages[0]?.facets).toEqual([]);
    expect(map.chunks[0]?.facets).toEqual([]);
  });

  it("parses a valid YAML config and applies defaults", () => {
    const config = parseConfig(`
name: Example Docs
slug: example-docs
sources:
  - type: local_markdown
    path: ./docs
`);

    expect(config.output.dir).toBe(".agentdocs");
    expect(config.doctor.minScore).toBe(70);
    expect(config.context.exclusiveKeys).toEqual(["version", "framework", "router", "runtime", "locale"]);
    expect(config.normalization.mdx).toBe("tolerant");
  });

  it("parses preferred context and deterministic facet rules", () => {
    const config = parseConfig(`
name: Example Docs
slug: example-docs
sources:
  - type: local_markdown
    path: ./docs
    facets:
      runtime: node
context:
  preferred:
    version: v5
    framework: react
  rules:
    - match: "**/react/**"
      facets:
        framework: react
`);

    expect(config.context.preferred).toEqual({ version: "v5", framework: "react" });
    expect(config.context.rules[0]).toEqual({
      match: "**/react/**",
      facets: { framework: "react" },
    });
  });

  it("returns actionable validation errors", () => {
    expect(() =>
      parseConfig(`
name: Example Docs
slug: Invalid Slug
sources: []
`),
    ).toThrowError(ConfigValidationError);

    expect(() =>
      parseConfig(`
name: Example Docs
slug: Invalid Slug
sources: []
`),
    ).toThrowError(/slug: must contain lowercase letters/);
  });

  it("accepts repository sources from the public config contract", () => {
    const config = parseConfig(`
name: Example Docs
slug: example-docs
sources:
  - type: repo
    path: .
    include:
      - docs/**
`);

    expect(config.sources[0]).toMatchObject({ type: "repo", path: "." });
  });

  it("parses local and repo source limits for large-repo shards", () => {
    const config = parseConfig(`
name: Example Docs
slug: example-docs
sources:
  - type: local_markdown
    path: ./docs
    limits:
      maxFiles: 100
      maxBytes: 5000000
      maxPages: 80
      maxElapsedMs: 60000
  - type: repo
    path: .
    include:
      - docs/**/*.md
    limits:
      maxFiles: 20
`);

    expect(config.sources[0]).toMatchObject({
      type: "local_markdown",
      limits: {
        maxFiles: 100,
        maxBytes: 5000000,
        maxPages: 80,
        maxElapsedMs: 60000,
      },
    });
    expect(config.sources[1]).toMatchObject({
      type: "repo",
      limits: { maxFiles: 20 },
    });
  });
});
