import { z } from "zod";

export const HeadingSchema = z
  .object({
    id: z.string().min(1),
    depth: z.number().int().min(1).max(6),
    text: z.string().min(1),
    slug: z.string().min(1),
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

export const EvidenceSchema = z
  .object({
    source: z.enum(["page", "heading", "link", "code_block", "openapi", "config"]),
    pageId: z.string().min(1).optional(),
    headingId: z.string().min(1).optional(),
    chunkId: z.string().min(1).optional(),
    codeBlockId: z.string().min(1).optional(),
    url: z.string().optional(),
    repoPath: z.string().min(1).optional(),
    quote: z.string().optional(),
  })
  .strict();

export const ContextFacetSchema = z
  .object({
    key: z.string().min(1),
    value: z.string().min(1),
    evidence: z.array(EvidenceSchema).min(1),
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
    facets: z.array(ContextFacetSchema).default([]),
    normalization: z
      .object({
        mode: z.enum(["strict", "mdx-fallback", "html", "rest", "asciidoc"]),
        warnings: z.array(z.string()),
        omittedCharacterRatio: z.number().min(0).max(1).optional(),
      })
      .strict()
      .default({ mode: "strict", warnings: [] }),
  })
  .strict();

export const ChunkSchema = z
  .object({
    id: z.string().min(1),
    pageId: z.string().min(1),
    kind: z.enum(["section", "table_row"]).default("section"),
    headingPath: z.array(z.string().min(1)),
    text: z.string().min(1),
    tokenEstimate: z.number().int().positive(),
    links: z.array(z.string()),
    entityIds: z.array(z.string()),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    facets: z.array(ContextFacetSchema).default([]),
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

export const TaskCodeExampleSchema = z
  .object({
    language: z.string().optional(),
    value: z.string().min(1),
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
    // Strings remain accepted for older hand-authored maps; generated packs
    // emit structured examples with their own code-block evidence.
    codeExamples: z.array(z.union([z.string(), TaskCodeExampleSchema])),
    evidence: z.array(EvidenceSchema).min(1),
    context: z
      .object({
        facets: z.record(z.array(z.string().min(1))),
        conflicts: z.array(
          z.object({
            key: z.string().min(1),
            values: z.array(z.string().min(1)).min(2),
            evidence: z.array(EvidenceSchema).min(1),
          }).strict(),
        ),
      })
      .strict()
      .default({ facets: {}, conflicts: [] }),
  })
  .strict();

const AgentMapV2Schema = z
  .object({
    schemaVersion: z.literal("0.2.0"),
    pages: z.array(DocPageSchema),
    chunks: z.array(ChunkSchema),
    entities: z.array(EntitySchema),
    edges: z.array(EdgeSchema),
    taskPacks: z.array(TaskPackSchema),
  })
  .strict();

export const AgentMapSchema = z.preprocess((value) => upgradeSchemaVersion(value), AgentMapV2Schema);

const ManifestV2Schema = z
  .object({
    schemaVersion: z.literal("0.2.0"),
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
    sourceCoverage: z.lazy(() => SourceCoverageSchema).optional(),
  })
  .strict();

export const ManifestSchema = z.preprocess((value) => upgradeSchemaVersion(value), ManifestV2Schema);

export const ReadinessCategorySchema = z.enum([
  "discoverability",
  "structure",
  "task_coverage",
  "version_safety",
  "agent_safety",
  "runtime_readiness",
]);

export const ReadinessCheckResultSchema = z
  .object({
    id: z.string().min(1),
    category: ReadinessCategorySchema,
    status: z.enum(["pass", "warn", "fail"]),
    scoreImpact: z.number().max(0),
    message: z.string().min(1),
    evidence: z.array(EvidenceSchema),
    recommendation: z.string().min(1).optional(),
  })
  .strict();

const ReadinessReportV2Schema = z
  .object({
    schemaVersion: z.literal("0.2.0"),
    score: z.number().int().min(0).max(100),
    category: ReadinessCategorySchema.optional(),
    summary: z
      .object({
        pass: z.number().int().nonnegative(),
        warn: z.number().int().nonnegative(),
        fail: z.number().int().nonnegative(),
      })
      .strict(),
    checks: z.array(ReadinessCheckResultSchema),
  })
  .strict();

export const ReadinessReportSchema = z.preprocess(
  (value) => upgradeSchemaVersion(value),
  ReadinessReportV2Schema,
);

export const MissingMetricReasonSchema = z.enum([
  "unsupported_format",
  "scale_limited",
  "scope_mismatch",
  "retrieval_mismatch",
  "historical_metric_not_captured",
  "preparation_blocked",
]);

export const SkipReasonSchema = z.enum([
  "empty",
  "include-missing",
  "include-out-of-scope",
  "include-cycle",
  "include-depth",
  "include-unsupported-format",
  "include-antora-id",
]);

const SUPPORTED_FORMAT_KEYS = {
  markdown: 0,
  mdx: 0,
  rst: 0,
  restText: 0,
  adoc: 0,
  asciidoc: 0,
} as const;

const UNSUPPORTED_FORMAT_KEYS = {
  rst: 0,
  restText: 0,
  adoc: 0,
  asciidoc: 0,
} as const;

const HistoricalSourceCoverageDefault = {
  supportedFiles: 0,
  unsupportedFiles: 0,
  intendedFiles: 0,
  compiledFiles: 0,
  degradedFiles: 0,
  skippedFiles: 0,
  failedFiles: 0,
  coverageRatio: 0,
  supportedByFormat: { ...SUPPORTED_FORMAT_KEYS },
  unsupportedByFormat: { ...UNSUPPORTED_FORMAT_KEYS },
  gapSeverity: "warn" as const,
  gapReason: "historical_metric_not_captured" as const,
  message: "Historical source coverage metrics were not captured.",
};

const SUPPORTED_BY_FORMAT_SHAPE = z
  .object({
    markdown: z.number().int().nonnegative(),
    mdx: z.number().int().nonnegative(),
    rst: z.number().int().nonnegative().default(0),
    restText: z.number().int().nonnegative().default(0),
    adoc: z.number().int().nonnegative().default(0),
    asciidoc: z.number().int().nonnegative().default(0),
  })
  .strict();

const UNSUPPORTED_BY_FORMAT_SHAPE = z
  .object({
    rst: z.number().int().nonnegative(),
    restText: z.number().int().nonnegative(),
    adoc: z.number().int().nonnegative(),
    asciidoc: z.number().int().nonnegative(),
  })
  .strict();

export const SourceCoverageSchema = z
  .preprocess((value) => upgradeSourceCoverage(value), z
    .object({
      supportedFiles: z.number().int().nonnegative(),
      unsupportedFiles: z.number().int().nonnegative(),
      intendedFiles: z.number().int().nonnegative(),
      compiledFiles: z.number().int().nonnegative(),
      degradedFiles: z.number().int().nonnegative(),
      skippedFiles: z.number().int().nonnegative(),
      failedFiles: z.number().int().nonnegative(),
      coverageRatio: z.number().min(0).max(1),
      supportedByFormat: SUPPORTED_BY_FORMAT_SHAPE,
      unsupportedByFormat: UNSUPPORTED_BY_FORMAT_SHAPE,
      gapSeverity: z.enum(["none", "warn", "fail"]),
      gapReason: MissingMetricReasonSchema.optional(),
      message: z.string().min(1),
    })
    .strict());

function upgradeSourceCoverage(value: unknown): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  const coverage = value as Record<string, unknown>;
  const supportedByFormat = coverage.supportedByFormat;
  if (supportedByFormat === null || typeof supportedByFormat !== "object" || Array.isArray(supportedByFormat)) {
    return coverage;
  }
  const supported = supportedByFormat as Record<string, unknown>;
  const hasNewKeys = ["rst", "restText", "adoc", "asciidoc"].every((key) => key in supported);
  if (hasNewKeys) {
    return coverage;
  }
  return {
    ...coverage,
    supportedByFormat: { ...SUPPORTED_FORMAT_KEYS, ...supported },
  };
}

const SourceLimitConfigSchema = z
  .object({
    maxFiles: z.number().int().positive().optional(),
    maxBytes: z.number().int().positive().optional(),
    maxPages: z.number().int().positive().optional(),
    maxElapsedMs: z.number().int().positive().optional(),
  })
  .strict();

export const SourceLimitDiagnosticsSchema = z
  .object({
    configured: SourceLimitConfigSchema.default({}),
    reached: z.array(z.enum(["maxFiles", "maxBytes", "maxPages", "maxElapsedMs"])).default([]),
    totalDocsLikeFiles: z.number().int().nonnegative(),
    selectedDocsLikeFiles: z.number().int().nonnegative(),
    totalSupportedFiles: z.number().int().nonnegative(),
    selectedSupportedFiles: z.number().int().nonnegative(),
    skippedByLimit: z.number().int().nonnegative(),
    selectedBytes: z.number().int().nonnegative(),
    message: z.string().min(1),
  })
  .strict();

export const SearchDocumentSchema = z
  .object({
    pageId: z.string().min(1),
    chunkId: z.string().min(1),
    title: z.string().min(1),
    sourceUrl: z.string().optional(),
    repoPath: z.string().min(1).optional(),
    headingPath: z.array(z.string()),
    text: z.string().min(1),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    facets: z.array(ContextFacetSchema).default([]),
    taskPackIds: z.array(z.string().min(1)).default([]),
  })
  .strict();

export const SearchIndexFallbackSchema = z
  .object({
    schemaVersion: z.literal(1),
    backend: z.literal("lexical"),
    documents: z.array(SearchDocumentSchema),
    preferredFacets: z.record(z.string()).default({}),
    exclusiveKeys: z.array(z.string()).default([]),
  })
  .strict();

export const SearchResultSchema = z
  .object({
    title: z.string().min(1),
    sourceUrl: z.string().optional(),
    repoPath: z.string().min(1).optional(),
    headingPath: z.array(z.string()),
    snippet: z.string(),
    score: z.number().nonnegative(),
    pageId: z.string().min(1),
    chunkId: z.string().min(1),
    facets: z.array(ContextFacetSchema).default([]),
  })
  .strict();

export const SearchResponseSchema = z
  .object({
    query: z.string(),
    results: z.array(SearchResultSchema),
    warnings: z
      .array(
        z
          .object({
            code: z.literal("context_conflict"),
            key: z.string().min(1),
            values: z.array(z.string().min(1)).min(2),
          })
          .strict(),
      )
      .default([]),
  })
  .strict();

export const ContextRequirementGapSchema = z
  .object({
    requirement: z.string().min(1),
    status: z.enum(["partial", "missing", "unknown"]),
    ref: z.string().min(1).optional(),
  })
  .strict();

export const ContextReadinessSchema = z
  .object({
    recommendation: z.enum(["implement", "inspect", "stop"]),
    coverage: z.enum(["complete", "partial", "unknown"]),
    issueCodes: z.array(z.string().min(1)),
    gaps: z.array(ContextRequirementGapSchema).default([]),
  })
  .strict();

export const RequirementAssessmentSchema = z
  .object({
    kind: z.enum(["facet", "symbol", "configuration", "constraint"]),
    value: z.string().min(1),
    source: z.enum(["explicit", "inferred"]),
    status: z.enum(["covered", "partial", "missing", "contradicted", "unknown"]),
    message: z.string().min(1),
    evidence: z.array(EvidenceSchema),
  })
  .strict();

const QueryRequirementSchema = z
  .object({
    kind: z.enum(["facet", "symbol", "configuration", "constraint"]),
    value: z.string().min(1),
    source: z.enum(["explicit", "inferred"]),
    status: z.enum(["covered", "partial", "missing", "contradicted", "unknown"]),
    evidence: z.array(EvidenceSchema),
  })
  .strict();

export const ContextNavigationHeadingSchema = z
  .object({
    ref: z.string().min(1),
    headingPath: z.array(z.string()),
    depth: z.number().int().positive(),
    matchedFor: z.array(z.string().min(1)),
    evidenceKinds: z.array(z.enum(["prose", "code", "links"])),
    childHeadingCount: z.number().int().nonnegative(),
  })
  .strict();

export const ContextExternalReferenceSchema = z
  .object({
    status: z.literal("external_uningested"),
    url: z.string().min(1),
    label: z.string().min(1),
    sourceRef: z.string().min(1),
    sourcePageId: z.string().min(1),
    headingPath: z.array(z.string()),
  })
  .strict();

export const ContextNavigationBranchSchema = z
  .object({
    pageId: z.string().min(1),
    pageRef: z.string().min(1),
    title: z.string().min(1),
    sourceUrl: z.string().optional(),
    repoPath: z.string().min(1).optional(),
    facets: z.record(z.array(z.string().min(1))),
    headings: z.array(ContextNavigationHeadingSchema),
    externalReferences: z.array(ContextExternalReferenceSchema),
  })
  .strict();

export const ContextNavigationSchema = z
  .object({
    scopeRefs: z.array(z.string().min(1)),
    branches: z.array(ContextNavigationBranchSchema),
    externalReferences: z.array(ContextExternalReferenceSchema),
    complete: z.boolean(),
    nextCursor: z.string().min(1).optional(),
  })
  .strict();

export const QueryDocsResponseSchema = z
  .object({
    goal: z.string().min(1),
    task: z.string().min(1).optional(),
    answer: z.string().min(1),
    confidence: z.enum(["high", "medium", "low"]),
    steps: z.array(
      z.object({
        title: z.string().min(1),
        text: z.string().min(1),
        evidence: z.array(EvidenceSchema).min(1),
      }).strict(),
    ),
    codeExamples: z.array(
      z.object({
        language: z.string().optional(),
        value: z.string().min(1),
        evidence: z.array(EvidenceSchema).min(1),
      }).strict(),
    ),
    gotchas: z.array(
      z.object({
        text: z.string().min(1),
        severity: z.enum(["info", "warning", "critical"]),
        evidence: z.array(EvidenceSchema).min(1),
      }).strict(),
    ),
    citations: z.array(
      z.object({
        id: z.string().min(1),
        pageId: z.string().min(1).optional(),
        headingId: z.string().min(1).optional(),
        chunkId: z.string().min(1).optional(),
        codeBlockId: z.string().min(1).optional(),
        sourceUrl: z.string().optional(),
        repoPath: z.string().min(1).optional(),
        quote: z.string().optional(),
      }).strict(),
    ),
    followUpRefs: z.array(
      z.object({
        type: z.enum(["chunk", "code_block", "page", "task_pack"]),
        ref: z.string().min(1),
        pageId: z.string().min(1).optional(),
        chunkId: z.string().min(1).optional(),
        title: z.string().min(1),
        sourceUrl: z.string().optional(),
        repoPath: z.string().min(1).optional(),
        requiredFor: z.array(z.string().min(1)).optional(),
      }).strict(),
    ),
    warnings: z.array(z.string().min(1)),
    requirements: z.array(QueryRequirementSchema).default([]),
    readiness: ContextReadinessSchema,
    navigation: ContextNavigationSchema,
    estimatedTokens: z.number().int().nonnegative(),
  })
  .strict();

export const ReadPageResponseSchema = z
  .object({
    section: z.object({
      pageId: z.string().min(1),
      targetId: z.string().min(1).optional(),
      title: z.string().min(1),
      headingPath: z.array(z.string()),
      sourceUrl: z.string().optional(),
      repoPath: z.string().min(1).optional(),
      text: z.string(),
      part: z.number().int().positive(),
      complete: z.boolean(),
      nextRef: z.string().min(1).optional(),
      evidence: z.array(EvidenceSchema).min(1),
    }).strict(),
  })
  .strict();

export const GoalBundleSchema = z
  .object({
    summary: z.string().min(1),
    confidence: z.enum(["high", "medium", "low"]),
    steps: z.array(
      z
        .object({
          role: z.enum(["prerequisite", "setup", "implementation", "validation", "gotcha", "evidence"]),
          title: z.string().min(1),
          snippet: z.string().min(1),
          resource: z.string().min(1),
          pageId: z.string().min(1),
          chunkId: z.string().min(1),
        })
        .strict(),
    ).min(1).max(5),
    gotchas: z.array(z.string().min(1)),
    supportingResources: z.array(z.string().min(1)),
    warnings: z
      .array(
        z
          .object({
            code: z.literal("context_conflict"),
            key: z.string().min(1),
            values: z.array(z.string().min(1)).min(2),
          })
          .strict(),
      )
      .default([]),
  })
  .strict();

export const ContextBundleSchema = z
  .object({
    goal: z.string().min(1),
    summary: z.string().min(1),
    readFirst: z.array(z.string().min(1)),
    rules: z.array(z.string().min(1)),
    goalBundle: GoalBundleSchema,
    selectedTaskPack: z
      .object({
        id: z.string().min(1),
        title: z.string().min(1),
        confidence: z.enum(["high", "medium", "low"]),
        markdown: z.string().min(1),
      })
      .strict()
      .optional(),
    supportingResources: z.array(z.string().min(1)),
    search: SearchResponseSchema,
  })
  .strict();

export const TryResultSchema = z
  .object({
    source: z
      .object({
        kind: z.enum(["local_markdown", "website"]),
        value: z.string().min(1),
      })
      .strict(),
    crawl: z
      .object({
        discovery: z.enum(["sitemap", "links", "hybrid"]),
        scope: z.string().min(1),
        attempted: z.number().int().nonnegative(),
        collected: z.number().int().nonnegative(),
        skipped: z.number().int().nonnegative(),
        failed: z.number().int().nonnegative(),
        usable: z.number().int().nonnegative().optional(),
        unusable: z.number().int().nonnegative().optional(),
        duplicateContent: z.number().int().nonnegative().optional(),
        discoveryRequests: z.number().int().nonnegative().optional(),
        warnings: z.array(z.string().min(1)),
      })
      .strict()
      .optional(),
    pageCount: z.number().int().nonnegative(),
    chunkCount: z.number().int().nonnegative(),
    taskPackCount: z.number().int().nonnegative(),
    readiness: z
      .object({
        score: z.number().int().min(0).max(100),
        pass: z.number().int().nonnegative(),
        warn: z.number().int().nonnegative(),
        fail: z.number().int().nonnegative(),
        reportPath: z.string().min(1),
      })
      .strict(),
    context: ContextBundleSchema,
    next: z
      .object({
        command: z.string().min(1),
        prompt: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const BuildStateSchema = z
  .object({
    schemaVersion: z.literal(1),
    generatedAt: z.string().datetime(),
    outputDir: z.string().min(1),
    configHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    sources: z.array(
      z
        .object({
          id: z.string().min(1),
          type: z.enum(["website", "local_markdown", "repo", "openapi"]),
          value: z.string().min(1),
          hash: z.string().regex(/^[a-f0-9]{64}$/),
          fileCount: z.number().int().nonnegative().optional(),
          selectedFileCount: z.number().int().nonnegative().optional(),
          limits: SourceLimitDiagnosticsSchema.shape.configured.optional(),
          collectedAt: z.string().datetime(),
          expiresAt: z.string().datetime().optional(),
        })
        .strict(),
    ),
    artifacts: z.array(
      z
        .object({
          path: z.string().min(1),
          hash: z.string().regex(/^[a-f0-9]{64}$/),
        })
        .strict(),
    ),
  })
  .strict();

export const StatusReportSchema = z
  .object({
    schemaVersion: z.literal(1),
    checkedAt: z.string().datetime(),
    state: z.enum(["fresh", "stale", "unknown"]),
    outputDir: z.string().min(1),
    summary: z.string().min(1),
    sources: z.array(
      z
        .object({
          id: z.string().min(1),
          type: z.enum(["website", "local_markdown", "repo", "openapi"]),
          value: z.string().min(1),
          state: z.enum(["fresh", "stale", "unknown"]),
          reason: z.string().min(1),
          fileCount: z.number().int().nonnegative().optional(),
          selectedFileCount: z.number().int().nonnegative().optional(),
          limits: SourceLimitDiagnosticsSchema.shape.configured.optional(),
          collectedAt: z.string().datetime().optional(),
          expiresAt: z.string().datetime().optional(),
        })
        .strict(),
    ),
    artifacts: z.array(
      z
        .object({
          path: z.string().min(1),
          state: z.enum(["fresh", "stale", "missing", "unknown"]),
          reason: z.string().min(1),
        })
        .strict(),
    ),
    recommendations: z.array(z.string().min(1)),
  })
  .strict();

export const ContextVerificationSchema = z
  .object({
    schemaVersion: z.literal(2),
    task: z.string().min(1),
    status: z.enum(["pass", "warn", "fail"]),
    summary: z.string().min(1),
    issues: z.array(
      z
        .object({
          code: z.string().min(1),
          severity: z.enum(["info", "warning", "critical"]),
          message: z.string().min(1),
          evidence: z.array(EvidenceSchema).default([]),
        })
        .strict(),
    ),
    coverage: z.enum(["complete", "partial", "unknown"]),
    recommendation: z.enum(["implement", "inspect", "stop"]),
    requirements: z.array(RequirementAssessmentSchema),
    freshness: StatusReportSchema.optional(),
  })
  .strict();

export const AgentSetupSnippetSchema = z
  .object({
    client: z.enum(["codex", "claude", "cursor", "generic"]),
    title: z.string().min(1),
    format: z.enum(["toml", "json", "shell", "text"]),
    contents: z.string().min(1),
    prompt: z.string().min(1),
  })
  .strict();

export const HandoffBundleSchema = z
  .object({
    schemaVersion: z.literal(1),
    goal: z.string().min(1),
    context: ContextBundleSchema,
    freshness: StatusReportSchema.optional(),
    selectedTaskPack: ContextBundleSchema.shape.selectedTaskPack,
    topSources: z.array(SearchResultSchema),
    gotchas: z.array(z.string().min(1)),
    setupCommands: z.array(z.string().min(1)),
    mcp: z
      .object({
        command: z.string().min(1),
        prompt: z.string().min(1),
        suggestedTools: z.array(z.string().min(1)),
        resources: z.array(z.string().min(1)),
      })
      .strict(),
    warnings: z.array(z.string().min(1)),
  })
  .strict();

export const IngestManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    sourceType: z.enum(["local_markdown", "repo"]),
    sourcePath: z.string().min(1),
    provenancePath: z.string().min(1).optional(),
    pageCount: z.number().int().nonnegative(),
    counts: z
      .object({
        usable: z.number().int().nonnegative(),
        degraded: z.number().int().nonnegative(),
        skipped: z.number().int().nonnegative(),
        failed: z.number().int().nonnegative(),
      })
      .strict()
      .default({ usable: 0, degraded: 0, skipped: 0, failed: 0 }),
    sourceCoverage: SourceCoverageSchema.default(HistoricalSourceCoverageDefault),
    limits: SourceLimitDiagnosticsSchema.optional(),
    diagnostics: z
      .array(
        z
          .object({
            repoPath: z.string().min(1),
            status: z.enum(["usable", "degraded", "skipped", "failed"]),
            mode: z.enum(["strict", "mdx-fallback", "html", "rest", "asciidoc"]).optional(),
            warnings: z.array(z.string()).default([]),
            message: z.string().min(1).optional(),
            skipReason: SkipReasonSchema.optional(),
            includeTargets: z.array(z.string()).optional(),
          })
          .strict(),
      )
      .default([]),
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

export const SourceProvenanceManifestSchema = z
  .object({
    schemaVersion: z.number().int().positive(),
    task: z.string().min(1).optional(),
    source: z
      .object({
        type: z.string().min(1).optional(),
        origin: z.string().url().optional(),
        capturedAt: z.string().datetime().optional(),
        provenance: z.string().min(1).optional(),
        format: z.string().min(1).optional(),
        pageCount: z.number().int().nonnegative().optional(),
        byteCount: z.number().int().nonnegative().optional(),
        corpusHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
      })
      .strict()
      .optional(),
    sources: z.array(
      z
        .object({
          id: z.string().min(1),
          origin: z.string().url(),
          capturedAt: z.string().datetime().optional(),
          format: z.string().min(1).optional(),
          derived: z.boolean().optional(),
        })
        .strict(),
    ).optional(),
    files: z.array(
      z
        .object({
          path: z.string().min(1),
          sourceId: z.string().min(1).optional(),
          sourceUrl: z.string().url(),
          canonicalUrl: z.string().url().optional(),
          sha256: z.string().regex(/^[a-f0-9]{64}$/),
        })
        .strict(),
    ).min(1),
    evaluation: z
      .object({
        oracle: z.string().min(1).optional(),
        visibleTest: z.string().min(1).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const CrawlManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    sourceType: z.literal("website"),
    sourceUrl: z.string().url(),
    discovery: z.enum(["sitemap", "links", "hybrid"]),
    pageCount: z.number().int().nonnegative(),
    scope: z
      .object({
        kind: z.enum(["inferred", "explicit"]),
        pathPrefix: z.string().min(1).optional(),
        include: z.array(z.string()),
        exclude: z.array(z.string()),
      })
      .strict()
      .optional(),
    sitemapUrls: z.array(z.string().url()).optional(),
    counts: z
      .object({
        attempted: z.number().int().nonnegative(),
        collected: z.number().int().nonnegative(),
        skipped: z.number().int().nonnegative(),
        failed: z.number().int().nonnegative(),
        usable: z.number().int().nonnegative().optional(),
        unusable: z.number().int().nonnegative().optional(),
        duplicateContent: z.number().int().nonnegative().optional(),
        discoveryRequests: z.number().int().nonnegative().optional(),
      })
      .strict()
      .optional(),
    warnings: z.array(z.string().min(1)).optional(),
    diagnostics: z.object({
      scopeConfidence: z.enum(["low", "medium", "high"]),
      topLevelPathDistribution: z.record(z.number().int().nonnegative()),
      suggestedIncludes: z.array(z.string()),
      budgetExhausted: z.boolean(),
      uncollectedLinkCount: z.number().int().nonnegative(),
    }).strict().optional(),
    failures: z
      .array(
        z
          .object({
            url: z.string().url(),
            reason: z.enum([
              "request_failed",
              "http_error",
              "cross_origin_redirect",
              "too_many_redirects",
              "unsupported_content_type",
              "invalid_content",
            ]),
            message: z.string().min(1),
          })
          .strict(),
      )
      .optional(),
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
          normalizedFrom: z.enum(["html", "markdown"]).optional(),
          markdownAlternateUrl: z.string().url().optional(),
        })
        .strict(),
    ),
    unusablePages: z
      .array(
        z
          .object({
            sourceUrl: z.string().url(),
            canonicalUrl: z.string().url().optional(),
            rawHtmlPath: z.string().min(1),
            reason: z.enum(["empty_content", "heading_only", "extraction_failed"]),
            message: z.string().min(1),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();

export type Heading = z.infer<typeof HeadingSchema>;
export type Link = z.infer<typeof LinkSchema>;
export type CodeBlock = z.infer<typeof CodeBlockSchema>;
export type ContextFacet = z.infer<typeof ContextFacetSchema>;
export type DocPage = z.infer<typeof DocPageSchema>;
export type Chunk = z.infer<typeof ChunkSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
export type EntityType = z.infer<typeof EntityTypeSchema>;
export type Entity = z.infer<typeof EntitySchema>;
export type EdgeType = z.infer<typeof EdgeTypeSchema>;
export type Edge = z.infer<typeof EdgeSchema>;
export type TaskStep = z.infer<typeof TaskStepSchema>;
export type Gotcha = z.infer<typeof GotchaSchema>;
export type TaskCodeExample = z.infer<typeof TaskCodeExampleSchema>;
export type TaskPack = z.infer<typeof TaskPackSchema>;
export type AgentMap = z.infer<typeof AgentMapSchema>;
export type Manifest = z.infer<typeof ManifestSchema>;
export type MissingMetricReason = z.infer<typeof MissingMetricReasonSchema>;
export type SourceCoverage = z.infer<typeof SourceCoverageSchema>;
export type SourceLimitConfig = z.infer<typeof SourceLimitConfigSchema>;
export type SourceLimitDiagnostics = z.infer<typeof SourceLimitDiagnosticsSchema>;
export type ReadinessCategory = z.infer<typeof ReadinessCategorySchema>;
export type SkipReason = z.infer<typeof SkipReasonSchema>;
export type ReadinessCheckResult = z.infer<typeof ReadinessCheckResultSchema>;
export type ReadinessReport = z.infer<typeof ReadinessReportSchema>;
export type SearchDocument = z.infer<typeof SearchDocumentSchema>;
export type SearchIndexFallback = z.infer<typeof SearchIndexFallbackSchema>;
export type SearchResult = z.infer<typeof SearchResultSchema>;
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
export type ContextReadiness = z.infer<typeof ContextReadinessSchema>;
export type RequirementAssessment = z.infer<typeof RequirementAssessmentSchema>;
export type QueryDocsResponse = z.infer<typeof QueryDocsResponseSchema>;
export type ContextNavigationHeading = z.infer<typeof ContextNavigationHeadingSchema>;
export type ContextExternalReference = z.infer<typeof ContextExternalReferenceSchema>;
export type ContextNavigationBranch = z.infer<typeof ContextNavigationBranchSchema>;
export type ContextNavigation = z.infer<typeof ContextNavigationSchema>;
export type ReadPageResponse = z.infer<typeof ReadPageResponseSchema>;
export type GoalBundle = z.infer<typeof GoalBundleSchema>;
export type ContextBundle = z.infer<typeof ContextBundleSchema>;
export type TryResult = z.infer<typeof TryResultSchema>;
export type BuildState = z.infer<typeof BuildStateSchema>;
export type StatusReport = z.infer<typeof StatusReportSchema>;
export type ContextVerification = z.infer<typeof ContextVerificationSchema>;
export type AgentSetupSnippet = z.infer<typeof AgentSetupSnippetSchema>;
export type HandoffBundle = z.infer<typeof HandoffBundleSchema>;
export type IngestManifest = z.infer<typeof IngestManifestSchema>;
export type SourceProvenanceManifest = z.infer<typeof SourceProvenanceManifestSchema>;
export type CrawlManifest = z.infer<typeof CrawlManifestSchema>;

function upgradeSchemaVersion(value: unknown): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  const artifact = value as Record<string, unknown>;
  return artifact.schemaVersion === "0.1.0"
    ? { ...artifact, schemaVersion: "0.2.0" }
    : value;
}
