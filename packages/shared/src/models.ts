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
export type IngestManifest = z.infer<typeof IngestManifestSchema>;
export type CrawlManifest = z.infer<typeof CrawlManifestSchema>;
