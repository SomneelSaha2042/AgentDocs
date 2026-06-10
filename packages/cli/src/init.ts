import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { parseConfig } from "@agentdocs/shared";

export const STARTER_CONFIG = `# AgentDocs configuration
# Add one or more documentation sources. Uncomment examples as needed.
name: My Project
slug: my-project
version: current

sources:
  - type: local_markdown
    path: ./docs
    include:
      - "**/*.md"
      - "**/*.mdx"
    exclude:
      - "**/drafts/**"

  # Website source example:
  # - type: website
  #   url: https://docs.example.com
  #   include:
  #     - /docs/**
  #   exclude:
  #     - /blog/**

  # OpenAPI source example:
  # - type: openapi
  #   path: ./openapi.yaml

output:
  dir: .agentdocs
  writeLlmsTxt: true
  writeAgentsMd: true
  writeTaskPacks: true
  writeMcpManifest: true

agent:
  preferredLanguage: typescript
  preferredPackageManager: pnpm
  rules:
    - Do not use deprecated APIs.

doctor:
  minScore: 70
  failOnBrokenLinks: false
  failOnMissingTaskPacks: false
`;

export type InitOptions = {
  config: string;
  cwd: string;
  force: boolean;
  out?: string;
};

export class InitConfigError extends Error {
  override readonly name = "InitConfigError";
}

export async function initConfig(options: InitOptions): Promise<string> {
  parseConfig(STARTER_CONFIG);

  const destinationDirectory = path.resolve(options.cwd, options.out ?? ".");
  const configPath = path.resolve(destinationDirectory, options.config);

  await mkdir(destinationDirectory, { recursive: true });
  try {
    await writeFile(configPath, STARTER_CONFIG, {
      encoding: "utf8",
      flag: options.force ? "w" : "wx",
    });
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "EEXIST"
    ) {
      throw new InitConfigError(
        `Config already exists at ${configPath}. Use --force to overwrite it.`,
      );
    }
    throw error;
  }

  return configPath;
}
