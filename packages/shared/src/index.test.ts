import { describe, expect, it } from "vitest";

import {
  AGENTDOCS_PACKAGE_NAME,
  ConfigValidationError,
  parseConfig,
} from "./index.js";

describe("@agentdocs/shared", () => {
  it("exposes the package placeholder", () => {
    expect(AGENTDOCS_PACKAGE_NAME).toBe("AgentDocs");
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
});
