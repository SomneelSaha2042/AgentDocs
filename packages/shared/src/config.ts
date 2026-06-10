import { parse as parseYaml } from "yaml";
import { z } from "zod";

const WebsiteSourceSchema = z
  .object({
    type: z.literal("website"),
    url: z.string().url(),
    include: z.array(z.string()).optional(),
    exclude: z.array(z.string()).optional(),
    sitemap: z.string().url().optional(),
  })
  .strict();

const LocalMarkdownSourceSchema = z
  .object({
    type: z.literal("local_markdown"),
    path: z.string().min(1),
    include: z.array(z.string()).optional(),
    exclude: z.array(z.string()).optional(),
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
    include: z.array(z.string()).optional(),
    exclude: z.array(z.string()).optional(),
  })
  .strict();

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
    doctor: z
      .object({
        minScore: z.number().int().min(0).max(100).default(70),
        failOnBrokenLinks: z.boolean().default(false),
        failOnMissingTaskPacks: z.boolean().default(false),
      })
      .strict()
      .default({}),
  })
  .strict();

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
