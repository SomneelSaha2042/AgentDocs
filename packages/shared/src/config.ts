import { parse as parseYaml } from "yaml";
import { z } from "zod";

const SourceLimitsSchema = z
  .object({
    maxFiles: z.number().int().positive().optional(),
    maxBytes: z.number().int().positive().optional(),
    maxPages: z.number().int().positive().optional(),
    maxElapsedMs: z.number().int().positive().optional(),
  })
  .strict();

const WebsiteSourceSchema = z
  .object({
    type: z.literal("website"),
    url: z.string().url(),
    include: z.array(z.string()).optional(),
    exclude: z.array(z.string()).optional(),
    sitemap: z.string().url().optional(),
    facets: z.record(z.string().min(1)).optional(),
  })
  .strict();

const LocalMarkdownSourceSchema = z
  .object({
    type: z.literal("local_markdown"),
    path: z.string().min(1),
    sourceManifest: z.string().min(1).optional(),
    include: z.array(z.string()).optional(),
    exclude: z.array(z.string()).optional(),
    facets: z.record(z.string().min(1)).optional(),
    limits: SourceLimitsSchema.optional(),
  })
  .strict();

const OpenApiSourceSchema = z
  .object({
    type: z.literal("openapi"),
    path: z.string().min(1),
  })
  .strict();

const RepoSourceSchema = z
  .object({
    type: z.literal("repo"),
    path: z.string().min(1),
    sourceManifest: z.string().min(1).optional(),
    include: z.array(z.string()).optional(),
    exclude: z.array(z.string()).optional(),
    facets: z.record(z.string().min(1)).optional(),
    limits: SourceLimitsSchema.optional(),
  })
  .strict();

const OPENAPI_UNSUPPORTED_MESSAGE =
  "OpenAPI ingestion is planned but not supported in this build. Use local_markdown, repo, or website sources.";

export const AgentDocsConfigSchema = z
  .object({
    name: z.string().min(1),
    slug: z
      .string()
      .min(1)
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "must contain lowercase letters, numbers, and hyphens only",
      ),
    version: z.string().min(1).optional(),
    sources: z
      .array(
        z.discriminatedUnion("type", [
          WebsiteSourceSchema,
          LocalMarkdownSourceSchema,
          OpenApiSourceSchema,
          RepoSourceSchema,
        ]),
      )
      .min(1),
    output: z
      .object({
        dir: z.string().min(1).default(".agentdocs"),
        writeLlmsTxt: z.boolean().default(true),
        writeAgentsMd: z.boolean().default(true),
        writeTaskPacks: z.boolean().default(true),
        writeMcpManifest: z.boolean().default(true),
      })
      .strict()
      .default({}),
    agent: z
      .object({
        preferredLanguage: z.string().min(1).optional(),
        preferredPackageManager: z.string().min(1).optional(),
        rules: z.array(z.string().min(1)).default([]),
      })
      .strict()
      .default({}),
    context: z
      .object({
        preferred: z.record(z.string().min(1)).default({}),
        exclusiveKeys: z.array(z.string().min(1)).default([
          "version",
          "framework",
          "router",
          "runtime",
          "locale",
        ]),
        rules: z
          .array(
            z
              .object({
                match: z.string().min(1),
                facets: z.record(z.string().min(1)),
              })
              .strict(),
          )
          .default([]),
      })
      .strict()
      .default({}),
    normalization: z
      .object({
        mdx: z.enum(["tolerant", "strict"]).default("tolerant"),
      })
      .strict()
      .default({}),
    freshness: z
      .object({
        websiteTtlHours: z.number().positive().default(24),
      })
      .strict()
      .default({}),
    tasks: z
      .array(
        z.object({
          id: z.string().min(1),
          title: z.string().min(1),
          queries: z.array(z.string().min(1)).min(1),
          requiredFacets: z.record(z.string().min(1)).default({}),
        }).strict(),
      )
      .default([]),
    doctor: z
      .object({
        minScore: z.number().int().min(0).max(100).default(70),
        failOnBrokenLinks: z.boolean().default(false),
        failOnMissingTaskPacks: z.boolean().default(false),
      })
      .strict()
      .default({}),
  })
  .strict()
  .superRefine((config, ctx) => {
    config.sources.forEach((source, index) => {
      if (source.type === "openapi") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: OPENAPI_UNSUPPORTED_MESSAGE,
          path: ["sources", index, "type"],
        });
      }
    });
  });

export type AgentDocsConfig = z.infer<typeof AgentDocsConfigSchema>;

export class ConfigValidationError extends Error {
  override readonly name = "ConfigValidationError";
}

export function parseConfig(value: string): AgentDocsConfig {
  let parsed: unknown;

  try {
    parsed = parseYaml(value);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ConfigValidationError(`Invalid YAML: ${message}`);
  }

  const result = AgentDocsConfigSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "config";
      return `${path}: ${issue.message}`;
    });
    throw new ConfigValidationError(`Invalid AgentDocs config:\n- ${issues.join("\n- ")}`);
  }

  return result.data;
}
