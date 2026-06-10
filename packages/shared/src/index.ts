export const AGENTDOCS_PACKAGE_NAME = "AgentDocs";

export {
  AgentDocsConfigSchema,
  ConfigValidationError,
  parseConfig,
} from "./config.js";
export type { AgentDocsConfig } from "./config.js";
export {
  CodeBlockSchema,
  CrawlManifestSchema,
  DocPageSchema,
  HeadingSchema,
  IngestManifestSchema,
  LinkSchema,
} from "./models.js";
export type {
  CodeBlock,
  CrawlManifest,
  DocPage,
  Heading,
  IngestManifest,
  Link,
} from "./models.js";
