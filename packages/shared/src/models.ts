import { z } from "zod";

export const HeadingSchema = z
  .object({
    id: z.string().min(1),
    depth: z.number().int().min(1).max(6),
    text: z.string(),
    slug: z.string(),
    position: z
      .object({
        startLine: z.number().int().positive().optional(),
        endLine: z.number().int().positive().optional(),
      })
      .strict(),
  })
  .strict();

export const LinkSchema = z
  .object({
    text: z.string(),
    href: z.string(),
    resolvedHref: z.string().optional(),
    kind: z.enum(["internal", "external", "anchor", "asset", "unknown"]),
    sourceHeadingId: z.string().optional(),
    isBroken: z.boolean().optional(),
  })
  .strict();

export const CodeBlockSchema = z
  .object({
    id: z.string().min(1),
    language: z.string().optional(),
    value: z.string(),
    sourceHeadingId: z.string().optional(),
    extracted: z
      .object({
        packages: z.array(z.string()).optional(),
        imports: z.array(z.string()).optional(),
        envVars: z.array(z.string()).optional(),
        cliCommands: z.array(z.string()).optional(),
        httpRoutes: z.array(z.string()).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const DocPageSchema = z
  .object({
    id: z.string().min(1),
    sourceType: z.enum(["website", "local_markdown", "openapi", "repo"]),
    sourceUrl: z.string().optional(),
    repoPath: z.string().min(1).optional(),
    canonicalUrl: z.string().optional(),
    title: z.string().min(1),
    description: z.string().optional(),
    markdown: z.string(),
    headings: z.array(HeadingSchema),
    links: z.array(LinkSchema),
    codeBlocks: z.array(CodeBlockSchema),
    frontmatter: z.record(z.unknown()).optional(),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    discoveredAt: z.string().datetime(),
    versionHints: z.array(z.string()),
  })
  .strict();

export const ChunkSchema = z
  .object({
    id: z.string().min(1),
    pageId: z.string().min(1),
    headingPath: z.array(z.string()),
    text: z.string().min(1),
    tokenEstimate: z.number().int().positive(),
    links: z.array(z.string()),
    entityIds: z.array(z.string()),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export const EvidenceSchema = z
  .object({
    source: z.enum(["page", "heading", "link", "code_block", "openapi", "config"]),
    pageId: z.string().min(1).optional(),
    headingId: z.string().min(1).optional(),
    codeBlockId: z.string().min(1).optional(),
    url: z.string().optional(),
    repoPath: z.string().min(1).optional(),
    quote: z.string().optional(),
  })
  .strict();

export const EntityTypeSchema = z.enum([
  "page",
  "concept",
  "api",
  "function",
  "class",
  "package",
  "cli_command",
  "config_key",
  "env_var",
  "error",
  "task",
  "version",
  "example",
]);

export const EntitySchema = z
  .object({
    id: z.string().min(1),
    type: EntityTypeSchema,
    name: z.string().min(1),
    aliases: z.array(z.string()),
    sourcePageIds: z.array(z.string().min(1)),
    evidence: z.array(EvidenceSchema).min(1),
  })
  .strict();

export const EdgeTypeSchema = z.enum([
  "links_to",
  "defines",
  "uses",
  "requires",
  "example_for",
  "error_for",
  "deprecated_by",
  "introduced_in",
  "versioned_as",
  "related_to",
]);

export const EdgeSchema = z
  .object({
    from: z.string().min(1),
    to: z.string().min(1),
    type: EdgeTypeSchema,
    evidence: z.array(EvidenceSchema).min(1),
    confidence: z.number().min(0).max(1),
  })
  .strict();

export const TaskStepSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().min(1),
    evidence: z.array(EvidenceSchema).min(1),
  })
  .strict();

export const GotchaSchema = z
  .object({
    text: z.string().min(1),
    severity: z.enum(["info", "warning", "critical"]),
    evidence: z.array(EvidenceSchema).min(1),
  })
  .strict();

export const TaskPackSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1),
    confidence: z.enum(["high", "medium", "low"]),
    requiredPages: z.array(z.string().min(1)),
    relatedEntities: z.array(z.string().min(1)),
    steps: z.array(TaskStepSchema).min(1),
    gotchas: z.array(GotchaSchema),
    codeExamples: z.array(z.string()),
    evidence: z.array(EvidenceSchema).min(1),
  })
  .strict();

export const AgentMapSchema = z
  .object({
    schemaVersion: z.literal("0.1.0"),
    pages: z.array(DocPageSchema),
    chunks: z.array(ChunkSchema),
    entities: z.array(EntitySchema),
    edges: z.array(EdgeSchema),
    taskPacks: z.array(TaskPackSchema),
  })
  .strict();

export const ManifestSchema = z
  .object({
    schemaVersion: z.literal("0.1.0"),
    project: z
      .object({
        name: z.string().min(1),
        slug: z.string().min(1),
        version: z.string().min(1).optional(),
      })
      .strict(),
    generatedAt: z.string().datetime(),
    sources: z.array(
      z
        .object({
          type: z.enum(["website", "local_markdown", "openapi", "repo"]),
          value: z.string().min(1),
        })
        .strict(),
    ),
    counts: z
      .object({
        pages: z.number().int().nonnegative(),
        chunks: z.number().int().nonnegative(),
        entities: z.number().int().nonnegative(),
        edges: z.number().int().nonnegative(),
        taskPacks: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();

export const IngestManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    sourceType: z.literal("local_markdown"),
    sourcePath: z.string().min(1),
    pageCount: z.number().int().nonnegative(),
    pages: z.array(
      z
        .object({
          id: z.string().min(1),
          repoPath: z.string().min(1),
          outputPath: z.string().min(1),
          contentHash: z.string().regex(/^[a-f0-9]{64}$/),
        })
        .strict(),
    ),
  })
  .strict();

export const CrawlManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    sourceType: z.literal("website"),
    sourceUrl: z.string().url(),
    discovery: z.enum(["sitemap", "links"]),
    pageCount: z.number().int().nonnegative(),
    pages: z.array(
      z
        .object({
          id: z.string().min(1),
          sourceUrl: z.string().url(),
          canonicalUrl: z.string().url(),
          rawHtmlPath: z.string().min(1),
          markdownPath: z.string().min(1),
          pagePath: z.string().min(1),
          contentHash: z.string().regex(/^[a-f0-9]{64}$/),
        })
        .strict(),
    ),
  })
  .strict();

export type Heading = z.infer<typeof HeadingSchema>;
export type Link = z.infer<typeof LinkSchema>;
export type CodeBlock = z.infer<typeof CodeBlockSchema>;
export type DocPage = z.infer<typeof DocPageSchema>;
export type Chunk = z.infer<typeof ChunkSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
export type EntityType = z.infer<typeof EntityTypeSchema>;
export type Entity = z.infer<typeof EntitySchema>;
export type EdgeType = z.infer<typeof EdgeTypeSchema>;
export type Edge = z.infer<typeof EdgeSchema>;
export type TaskStep = z.infer<typeof TaskStepSchema>;
export type Gotcha = z.infer<typeof GotchaSchema>;
export type TaskPack = z.infer<typeof TaskPackSchema>;
export type AgentMap = z.infer<typeof AgentMapSchema>;
export type Manifest = z.infer<typeof ManifestSchema>;
export type IngestManifest = z.infer<typeof IngestManifestSchema>;
export type CrawlManifest = z.infer<typeof CrawlManifestSchema>;
