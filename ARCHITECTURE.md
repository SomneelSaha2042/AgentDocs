# AgentDocs Architecture

This document is the high-level design reference for the current AgentDocs
implementation. It captures package responsibilities, data contracts,
pipeline behavior, dependency relationships, tests, known gaps, and CI posture.

Accuracy is mandatory. When implementation changes alter architecture,
package responsibilities, public contracts, pipeline flow, readiness behavior,
search/MCP behavior, dependency relationships, test coverage, or known gaps,
update this document in the same change. Do not leave speculative or stale
architecture notes here; use `Unknown`, `No evidence found`, or `Requires
manual review` when the current repository state cannot prove a claim.

The report below was initially persisted from the supplied high-level design
research note.

## Current Normalizer Hardening Notes

Verified on 2026-06-30:

- `chunkMarkdownByHeading` splits by heading-aware prose/code blocks. Prose may
  split to satisfy the approximate token target, but fenced code blocks are
  emitted whole, including oversized, unterminated, and nested fenced examples.
  Short setup prose that fits in a normal chunk is kept with an oversized code
  block so downstream task-pack scoring can associate explanation with example
  code.
- Deterministic extraction remains regex/state-machine based and does not
  execute source content. HTTP route entities are extracted only from structured
  evidence such as fenced code, inline code, standalone route lines, or Markdown
  tables, not from ordinary conversational prose.
- MDX normalization first attempts strict `remark-mdx` parsing. Tolerant
  fallback preserves headings, links, readable prose, and fenced code while
  replacing unsupported import/export, JSX syntax, and brace expressions outside
  fenced code with deterministic omission markers plus normalization warnings.

Here is the comprehensive research report on the shared package, indexer, graph, and doctor packages.                                    
  ──────                                                                                                                                   
  ##                                                                                                                                       
                                                                                                                                           
  ### Directory:  packages/shared/src/                                                                                                     
                                                                                                                                           
   File                                        │ Size                                        │ Purpose
  ─────────────────────────────────────────────┼─────────────────────────────────────────────┼─────────────────────────────────────────────
    models.ts                                  │ 29,267 bytes (955 lines)                    │ All Zod schemas and TypeScript types
    task-context.ts                            │ 23,119 bytes (614 lines)                    │  TaskContextAssembler  class
    config.ts                                  │ 4,757 bytes (139 lines)                     │ Config types and loader
    index.ts                                   │ 1,921 bytes (57 lines)                      │ Barrel exports
    index.test.ts                              │ 3,188 bytes                                 │ Tests for models
    task-context.test.ts                       │ 24,057 bytes                                │ Tests for TaskContextAssembler
                                                                                                                                           
  ### Complete Type/Schema Inventory from  models.ts                                                                                       
                                                                                                                                           
  #### Core Document Types                                                                                                                 
                                                                                                                                           
  •  HeadingSchema  /  Heading :  { id, depth (1-6), text, slug, position: { startLine?, endLine? } }                                      
  •  LinkSchema  /  Link :  { text, href, resolvedHref?, kind: "internal"|"external"|"anchor"|"asset"|"unknown", sourceHeadingId?,         
  isBroken? }                                                                                                                              
  •  CodeBlockSchema  /  CodeBlock :  { id, language?, value, sourceHeadingId?, extracted?: { packages?, imports?, envVars?, cliCommands?, 
  httpRoutes? } }                                                                                                                          
  •  EvidenceSchema  /  Evidence :  { source: "page"|"heading"|"link"|"code_block"|"openapi"|"config", pageId?, headingId?, codeBlockId?,  
  url?, repoPath?, quote? }                                                                                                                
  •  ContextFacetSchema  /  ContextFacet :  { key, value, evidence: Evidence[] }                                                           
  •  DocPageSchema  /  DocPage :  { id, sourceType, sourceUrl?, repoPath?, canonicalUrl?, title, description?, markdown, headings[],       
  links[], codeBlocks[], frontmatter?, contentHash, discoveredAt, versionHints[], facets[], normalization }                                
  •  ChunkSchema  /  Chunk :  { id, pageId, headingPath[], text, tokenEstimate, links[], entityIds[], contentHash, facets[] }              
                                                                                                                                           
  #### Entity/Graph Types                                                                                                                  
                                                                                                                                           
  •  EntityTypeSchema : enum  "page"|"concept"|"api"|"function"|"class"|"package"|"cli_command"|"config_key"|"env_var"|"error"|"task"|     
  "version"|"example"                                                                                                                      
  •  EntitySchema  /  Entity :  { id, type, name, aliases[], sourcePageIds[], evidence[] }                                                 
  •  EdgeTypeSchema : enum  "links_to"|"defines"|"uses"|"requires"|"example_for"|"error_for"|"deprecated_by"|"introduced_in"|              
  "versioned_as"|"related_to"                                                                                                              
  •  EdgeSchema  /  Edge :  { from, to, type, evidence[], confidence (0-1) }                                                               
                                                                                                                                           
  #### Task Pack Types                                                                                                                     
                                                                                                                                           
  •  TaskStepSchema :  { title, description, evidence[] }                                                                                  
  •  GotchaSchema :  { text, severity: "info"|"warning"|"critical", evidence[] }                                                           
  •  TaskPackSchema  /  TaskPack :  { id, title, description, confidence: "high"|"medium"|"low", requiredPages[], relatedEntities[],       
  steps[], gotchas[], codeExamples[], evidence[], context: { facets, conflicts[] } }                                                       
                                                                                                                                           
  #### Agent Map & Manifest                                                                                                                
                                                                                                                                           
  •  AgentMapSchema  (v0.2.0):  { schemaVersion, pages[], chunks[], entities[], edges[], taskPacks[] }                                     
  •  ManifestSchema  (v0.2.0):  { schemaVersion, project: { name, slug, version? }, generatedAt, sources[], counts, sourceCoverage? }      
                                                                                                                                           
  #### Search Types                                                                                                                        
                                                                                                                                           
  •  SearchDocumentSchema :  { pageId, chunkId, title, sourceUrl?, repoPath?, headingPath[], text, contentHash, facets[], taskPackIds[] }  
  •  SearchResultSchema :  { title, sourceUrl?, repoPath?, headingPath[], snippet, score, pageId, chunkId, facets[] }                      
  •  SearchResponseSchema :  { query, results[], warnings[] }                                                                              
  •  SearchIndexFallbackSchema :  { schemaVersion: 1, backend: "lexical", documents[], preferredFacets, exclusiveKeys[] }                  
                                                                                                                                           
  #### Query/Read Response Types                                                                                                           
                                                                                                                                           
  •  QueryDocsResponseSchema  /  QueryDocsResponse :  { goal, task?, answer, confidence, steps[], codeExamples[], gotchas[], citations[],  
  followUpRefs[], warnings[], estimatedTokens }                                                                                            
      • steps:  { title, text, evidence[] }                                                                                                
      • codeExamples:  { language?, value, evidence[] }                                                                                    
      • gotchas:  { text, severity, evidence[] }                                                                                           
      • citations:  { id, pageId?, headingId?, codeBlockId?, sourceUrl?, repoPath?, quote? }                                               
      • followUpRefs:  { type: "chunk", ref, pageId, chunkId, title, sourceUrl?, repoPath? }                                               
  •  ReadPageResponseSchema  /  ReadPageResponse :  { section: { pageId, chunkId?, title, headingPath[], sourceUrl?, repoPath?, text,      
  truncated, evidence[] } }                                                                                                                
                                                                                                                                           
  #### Context/Handoff Types                                                                                                               
                                                                                                                                           
  •  ContextBundleSchema :  { goal, summary, readFirst[], rules[], goalBundle, selectedTaskPack?, supportingResources[], search }          
  •  HandoffBundleSchema :  { schemaVersion: 1, goal, context, freshness, selectedTaskPack?, topSources[], gotchas[], setupCommands[], mcp,
  warnings[] }                                                                                                                             
                                                                                                                                           
  #### Status/Verification Types                                                                                                           
                                                                                                                                           
  •  BuildStateSchema :  { schemaVersion: 1, sources[], artifacts[] }                                                                      
  •  StatusReportSchema  /  StatusReport :  { schemaVersion: 1, checkedAt, state: "fresh"|"stale"|"unknown", outputDir, summary, sources[],
  artifacts[], recommendations[] }                                                                                                         
  •  ContextVerificationSchema  /  ContextVerification :  { schemaVersion: 1, task, status: "pass"|"warn"|"fail", summary, issues[],       
  freshness }                                                                                                                              
                                                                                                                                           
  #### Readiness Types                                                                                                                     
                                                                                                                                           
  •  ReadinessReportSchema :  { schemaVersion: "0.2.0", score, category?, summary, checks[], sourceCoverage? }                             
  •  SourceCoverageSchema :  { total, usable, unusable, degraded, skipped, formats }                                                       
                                                                                                                                           
  #### Config Types                                                                                                                        
                                                                                                                                           
  •  AgentDocsConfigSchema :  { project, sources[], context?, output? }                                                                    
      • project:  { name, slug, version? }                                                                                                 
      • sources:  { type, path?, url?, include?, exclude? }[]                                                                              
      • context:  { preferredFacets?, exclusiveKeys?, rules? }                                                                             
      • output:  { dir? }                                                                                                                  
                                                                                                                                           
  ──────                                                                                                                                   
  ## 2. TaskContextAssembler Implementation                                                                                                
                                                                                                                                           
  ###  queryDocs()  flow:                                                                                                                  
                                                                                                                                           
  1. Clamps limit to 1-3                                                                                                                   
  2. Selects a matching task pack via  selectTaskPack()  — scores packs by term matching on title/id/description/steps, search page overlap,
  and specific term bonuses/penalties                                                                                                      
  3. Ranks chunks via  rankChunks()  — combines search result position scores (24 - index*2), lexical term matching, and pack text overlap 
  4. Builds steps from top 5 ranked chunks + task pack steps, deduplicating by title:text, limited to  limit                               
  5. Builds code examples from all page code blocks, scored by: page relevance (+6 if from ranked page), chunk match (+10 if in ranked     
  chunks), pack match (+4), and lexical scoring. Limited to 1 example.                                                                     
  6. Builds gotchas from task pack gotchas, limited to 2                                                                                   
  7. Builds citations from evidence across steps, examples, gotchas — limited to 4                                                         
  8. Generates follow-up refs only when confidence is low or warnings exist — limited to 1                                                 
  9. Generates implementation hints using pattern matching (loop patterns, client initialization)                                          
  10. Constructs an answer string and returns the full  QueryDocsResponse                                                                  
                                                                                                                                           
  Key design decisions:                                                                                                                    
                                                                                                                                           
  • Code examples are aggressively limited to 1 per query                                                                                  
  • Token estimation uses  Math.ceil(value.length / 4)  (simple heuristic)                                                                 
  • Steps are capped at the limit (1-3), with preference for ranked chunks over task pack steps                                            
                                                                                                                                           
  ###  readPage()  flow:                                                                                                                   
                                                                                                                                           
  1. Accepts chunkId, pageId, heading, maxChars, fullPage                                                                                  
  2. Uses a cascading resolution: chunkId → code block ID → heading ID → page ID (tries each in order)                                     
  3. For chunk matches: returns chunk text, capped at  min(maxChars, 1000)  (DEFAULT_SECTION_MAX_CHARS)                                    
  4. For page-level reads: returns first chunk or page markdown excerpt (4000 chars)                                                       
  5. For full page reads ( fullPage: true ): returns raw  page.markdown  without truncation                                                
  ──────                                                                                                                                   
  ## 3. Indexer Search Implementation                                                                                                      
                                                                                                                                           
  ###  buildSearchIndex() :                                                                                                                
                                                                                                                                           
  1. Builds  SearchDocument[]  from agent map chunks                                                                                       
  2. Tries to write a SQLite FTS5 index using  node:sqlite                                                                                 
  3. Falls back to a JSON lexical index if SQLite unavailable                                                                              
  4. Uses atomic staging (write to  .tmp , then rename)                                                                                    
                                                                                                                                           
  ###  searchIndex() :                                                                                                                     
                                                                                                                                           
  1. Reads index (auto-detects SQLite vs JSON)                                                                                             
  2. Filters documents by facets and task pack                                                                                             
  3. Ranks using  rankDocuments() :                                                                                                        
      • Term distinctiveness (IDF-like):  log((totalPages + 1) / (docFreq + 1)) + 0.25                                                     
      • Term weight: stop words get 0.25 weight, others get 1.0                                                                            
      • Scoring: title matches (×8), heading matches (×4), text matches (×1), sequence bonuses, task pack match (+40), content type score, 
      facet preference                                                                                                                     
  4. Diversifies results: ensures page-level diversity first, then fills remaining slots                                                   
  ──────                                                                                                                                   
  ## 4. Graph Package                                                                                                                      
                                                                                                                                           
  ###  buildAgentMap() :                                                                                                                   
                                                                                                                                           
  1. Sorts pages and chunks deterministically                                                                                              
  2. Adds link edges between pages (resolves internal links to page IDs)                                                                   
  3. For each chunk: extracts entities (packages, imports, env vars, CLI commands, HTTP routes, deprecated markers, versions, warnings) and
  creates entity nodes + edges                                                                                                             
  4. For each code block on each page: creates an "example" entity + edges to extracted packages/imports/env vars/CLI commands/HTTP routes 
  5. Validates all references (chunks→entities, edges→nodes)                                                                               
                                                                                                                                           
  ### Link resolution:                                                                                                                     
                                                                                                                                           
  • Normalizes URLs (strips hash, trailing slash)                                                                                          
  • Creates aliases (with/without  .md  extension, with/without  /index )                                                                  
  • Matches against all page canonical URLs, source URLs, and repo paths                                                                   
  ──────                                                                                                                                   
  ## 5. Doctor / Readiness Package                                                                                                         
                                                                                                                                           
  ###  scanReadiness() :                                                                                                                   
                                                                                                                                           
  • 6 categories with weighted scoring: discoverability (20), structure (20), task_coverage (25), version_safety (15), agent_safety (10),  
  runtime_readiness (10)                                                                                                                   
  • Over 30 individual checks covering: artifact presence, page counts, heading structure, link health, code block coverage, entity        
  extraction, task pack coverage, version consistency, security markers, config validation                                                 
  • Quality cap: based on degraded/unusable page ratios and source coverage                                                                
  • Returns scored report with pass/fail/warn per check, actionable evidence                                                               
  ──────                                                                                                                                   
  ## 6. Duplicated Utility Functions                                                                                                       
                                                                                                                                           
  The following functions are copy-pasted across multiple packages:                                                                        
                                                                                                                                           
   Function                          │ Found in
  ───────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────
    compareStrings(left, right)      │  extract.ts ,  chunk.ts ,  generator.ts ,  artifacts.ts ,  task-context.ts ,  search.ts ,  graph.ts
                                     │ ,  context.ts  (8 files!)
    stableUnique(values)             │  generator.ts ,  artifacts.ts ,  task-context.ts ,  search.ts ,  graph.ts  (5 files)
    tokenize(value)                  │  artifacts.ts ,  task-context.ts ,  search.ts  (3 files — slightly different regex in search.ts,
                                     │ same in artifacts and task-context)
    scoreTerms(value, query)         │  artifacts.ts ,  task-context.ts  (2 files — different implementations! artifacts uses simpler
                                     │ version, task-context has specificity weighting and coverage ratio)
    taskPackSearchText(pack)         │  artifacts.ts ,  task-context.ts  (2 files — slightly different! task-context includes gotcha text)
    headingPathFor(page, headingId)  │  artifacts.ts ,  task-context.ts ,  generator.ts  (3 files — identical implementation)
    oneLine(value)                   │  generator.ts ,  task-context.ts ,  search.ts  (3 files)
    excerpt(value, max)              │  artifacts.ts ,  task-context.ts  (2 files — different max defaults)
    hash(value)                      │  extract.ts ,  chunk.ts ,  generator.ts  (via crypto),  graph.ts  (4 files)
    stableEvidence(evidence)         │  generator.ts ,  graph.ts ,  context.ts  (3 files — identical JSON.stringify dedup)
    arraysEqual(left, right)         │  generator.ts ,  task-context.ts  (2 files)
    isExternalImport(value)          │  chunk.ts ,  graph.ts  (2 files — identical)
    escapeRegExp(value)              │  extract.ts  (only 1, but could be shared)
                                                                  │ files)
    stableEvidence(evidence)                                      │  generator.ts ,  graph.ts ,  context.ts  (3 files — identical
                                                                  │ JSON.stringify dedup)
    arraysEqual(left, right)                                      │  generator.ts ,  task-context.ts  (2 files)
    isExternalImport(value)                                       │  chunk.ts ,  graph.ts  (2 files — identical)
    escapeRegExp(value)                                           │  extract.ts  (only 1, but could be shared)
    evidenceForChunk(page, chunk)  /  chunkEvidence(page, chunk)  │  generator.ts ,  task-context.ts ,  graph.ts  (3 files — same logic,
                                                                  │ different names!)
                                                                                                                                           
  ### Critical divergence:  scoreTerms()                                                                                                   
                                                                                                                                           
  •  artifacts.ts : Simple version — counts prefix matches + substring bonus of 5                                                          
  •  task-context.ts : Advanced version — uses specificity weighting ( term.length / 4 ), caps frequency at 2, applies coverage ratio      
  scaling, and only gives substring bonus for short queries (≤40 chars)                                                                    
                                                                                                                                           
  This means the same query will rank differently depending on whether it goes through  ArtifactService.buildGoalBundle()  vs              
  TaskContextAssembler.rankChunks() , which is a correctness bug.                                                                          
                                                                                                                                           
  [MESSAGE FROM Subagent 79430566-2b09-4387-bdbc-cc0d17291338 (Test and CLI researcher)]                                                   
                                                                                                                                           
  Here is the comprehensive research report on the CLI structure, test coverage, build plan, PRD alignment, dependencies, and CI           
  configuration.                                                                                                                           
  ──────                                                                                                                                   
  ## 1. CLI Command Structure                                                                                                              
                                                                                                                                           
  The CLI is implemented in  packages/cli/src/  with the following files:                                                                  
                                                                                                                                           
   File                                        │ Size                                        │ Purpose
  ─────────────────────────────────────────────┼─────────────────────────────────────────────┼─────────────────────────────────────────────
    agentdocs.ts                               │ 15,508 bytes (429 lines)                    │ Main CLI entry point with all commands
    index.ts                                   │ 55 bytes                                    │ Re-exports
                                                                                                                                           
  ### Commands (from  agentdocs.ts ):                                                                                                      
                                                                                                                                           
   Command     │ Description                                              │ Key Options
  ─────────────┼──────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────
    init       │ Initialize a new AgentDocs config (                      │  --path ,  --name ,  --slug ,  --source-type ,  --force 
               │ agentdocs.config.json )                                  │
    ingest     │ Ingest markdown from local directory                     │  --dir ,  --out ,  --include ,  --exclude  (with glob support)
    crawl      │ Crawl a website and generate normalized pages            │  --url ,  --out ,  --max-pages ,  --max-depth ,  --include ,  
               │                                                          │ --exclude 
    build      │ Full pipeline: ingest/crawl → normalize → graph →        │  --skip-crawl ,  --skip-index 
               │ generate → index                                         │
    search     │ Search built documentation artifacts                     │  --query ,  --limit ,  --json ,  --facets ,  --task 
    status     │ Check freshness of built artifacts                       │  --json ,  --force 
    readiness  │ Run the readiness report (doctor)                        │  --json ,  --category 
    serve-mcp  │ Start the MCP server over stdio                          │  --allowed-tools 
                                                                                                                                           
  ### Build Pipeline ( build  command):                                                                                                    
                                                                                                                                           
  1. Loads config from  agentdocs.config.json                                                                                              
  2. Ingests local markdown sources or crawls websites                                                                                     
  3. Normalizes pages through appropriate parsers (markdown/mdx/html/rst/asciidoc)                                                         
  4. Applies context facets (from config rules)                                                                                            
  5. Chunks pages by heading                                                                                                               
  6. Builds agent map (graph with entities and edges)                                                                                      
  7. Generates static artifacts (agents.md, llms.txt, task packs, manifest)                                                                
  8. Writes all artifacts to output directory                                                                                              
  9. Builds search index (SQLite FTS5 or lexical fallback)                                                                                 
  10. Records build state for freshness tracking                                                                                           
  ──────                                                                                                                                   
  ## 2. Test Coverage                                                                                                                      
                                                                                                                                           
  ### Test Files Found:                                                                                                                    
                                                                                                                                           
   Package                │ Test File              │ Size                  │ Tests
  ────────────────────────┼────────────────────────┼───────────────────────┼───────────────────────────────────────────────────────────────
   shared                 │  index.test.ts         │ 3,188 bytes           │ Schema validation: round-trips, content hash, rejects invalid
   shared                 │  task-context.test.ts  │ 24,057 bytes          │ 28+ tests for queryDocs and readPage
   normalizer             │  markdown.test.ts      │ 6,462 bytes           │ ~12 tests: headings, links, code blocks, MDX, frontmatter
   normalizer             │  chunk.test.ts         │ 5,173 bytes           │ ~8 tests: section splitting, token estimation, code blocks
   normalizer             │  extract.test.ts       │ 3,790 bytes           │ ~10 tests: packages, imports, env vars, CLI commands, routes
   normalizer             │  html.test.ts          │ 1,671 bytes           │ ~3 tests: basic HTML conversion
   normalizer             │  rest.test.ts          │ 4,661 bytes           │ ~10 tests: RST section conversion, directives, code blocks
   normalizer             │  asciidoc.test.ts      │ 4,786 bytes           │ ~8 tests: AsciiDoc headings, code blocks, admonitions
   generator              │  generator.test.ts     │ 32,013 bytes          │ ~25 tests with snapshot testing
   graph                  │  graph.test.ts         │ 3,619 bytes           │ ~6 tests: entities, edges, link resolution
   indexer                │  search.test.ts        │ 14,656 bytes          │ ~15 tests: indexing, search, FTS5, facets, diversification
   mcp-server             │  server.test.ts        │ 4,228 bytes           │ ~8 tests: JSON-RPC protocol, tool calls
   mcp-server             │  artifacts.test.ts     │ 4,045 bytes           │ ~7 tests: artifact service validation
   doctor                 │  readiness.test.ts     │ 14,389 bytes          │ ~20 tests: readiness checks, scoring
                                                                                                                                           
  ### Test Coverage Gaps:                                                                                                                  
                                                                                                                                           
  1. No integration tests that run the full CLI  build  pipeline end-to-end                                                                
  2. No tests for  context.ts  (context facet application) - this is a critical gap since facet assignment directly affects search routing 
  and task pack generation                                                                                                                 
  3. HTML normalizer tests are minimal (only 3 tests for a critical web-crawling path)                                                     
  4. No tests for the CLI commands themselves (no CLI smoke tests in the test suite, though there is a  smoke:bundle  script)              
  5. No tests for  codeLikeSegments()  or  rawImportStatements()  in extract.ts - these are new complex functions added recently           
  6. No tests for facet-based search filtering in the indexer                                                                              
  7. MCP server tests don't cover  query_docs  or  read_page  tool responses end-to-end                                                    
  ──────                                                                                                                                   
  ## 3. Build Plan Phase Status                                                                                                            
                                                                                                                                           
  From  BUILD_PLAN.md :                                                                                                                    
                                                                                                                                           
   Phase                       │ Name                        │ Status                     │ Evidence
  ─────────────────────────────┼─────────────────────────────┼────────────────────────────┼────────────────────────────────────────────────
   0                           │ Repo scaffolding            │ ✅ Done                    │ Monorepo with pnpm workspace
   1                           │ Config and CLI skeleton     │ ✅ Done                    │  agentdocs.config.json  support, commander CLI
   2                           │ Local markdown ingestion    │ ✅ Done                    │ Ingest command with glob support
   3                           │ Website crawling            │ ✅ Done                    │ Crawl command with depth/page limits
   4                           │ Normalization and chunking  │ ✅ Done                    │ Markdown/MDX/HTML/RST/AsciiDoc parsers
   5                           │ Graph and entity extraction │ ✅ Done                    │ Entity/edge graph with deterministic IDs
   6                           │ Artifact generation         │ ✅ Done                    │ AGENTS.md, llms.txt, task packs, manifest
   7                           │ Doctor/readiness report     │ ✅ Done                    │ Scored readiness with 30+ checks
   8                           │ Search/index                │ ✅ Done                    │ SQLite FTS5 with lexical fallback
   9                           │ MCP server                  │ ✅ Done                    │ 14 tools, JSON-RPC stdio transport
                                                                                                                                           
  All 10 phases are implemented. The project is in the polish/hardening stage, which matches the user's description of fixing issues found 
  during end-to-end testing.                                                                                                               
  ──────                                                                                                                                   
  ## 4. PRD Requirements Not Yet Met                                                                                                       
                                                                                                                                           
  From  PRD.md :                                                                                                                           
                                                                                                                                           
  ### Met Requirements:                                                                                                                    
                                                                                                                                           
  • ✅ Deterministic pipeline (no mandatory LLM)                                                                                           
  • ✅ Evidence-linked outputs                                                                                                             
  • ✅ Task packs over random chunks                                                                                                       
  • ✅ Local-first operation                                                                                                               
  • ✅ No source mutation                                                                                                                  
  • ✅ Schema-valid artifacts                                                                                                              
  • ✅ Multi-format parsing (MD, MDX, HTML, RST, AsciiDoc)                                                                                 
  • ✅ Context faceting and version safety                                                                                                 
  • ✅ MCP server with stdio transport                                                                                                     
                                                                                                                                           
  ### Gaps/Concerns:                                                                                                                       
                                                                                                                                           
  1. "No evaluation gaming" rule: The generator contains  TASK_FAMILIES  with domain-specific families like  route-handlers ,  query-      
  invalidation ,  schema-validation . The  TASK_SHAPE_SIGNALS  and  codeBlockImplementationScore  functions contain web-framework-specific 
  scoring logic. This is noted as a PRD violation in the existing review.                                                                  
  2. OpenAPI support: The PRD mentions OpenAPI as a source type ( sourceType: "openapi"  is in the schema), but there is no OpenAPI parser 
  in the normalizer package. The crawler/CLI would need to handle  .yaml / .json  OpenAPI files.                                           
  3. Rebuild with  --changed : The status command can detect staleness, but there's no  rebuild --changed  command for incremental rebuilds.
  4. Config schema completeness: The config schema supports  sources[].type: "openapi"  but there's no implementation path for it.         
  ──────                                                                                                                                   
  ## 5. Package Dependencies                                                                                                               
                                                                                                                                           
  ### Internal dependency graph:                                                                                                           
                                                                                                                                           
    cli → crawler, normalizer, graph, generator, indexer, mcp-server, doctor, shared                                                       
    mcp-server → indexer, shared                                                                                                           
    doctor → shared                                                                                                                        
    generator → shared                                                                                                                     
    graph → normalizer, shared                                                                                                             
    indexer → shared                                                                                                                       
    normalizer → shared                                                                                                                    
    crawler → (standalone, uses cheerio + undici)                                                                                          
    shared → zod                                                                                                                           
                                                                                                                                           
  ### Key External Dependencies:                                                                                                           
                                                                                                                                           
   Package                                              │ Used By                                 │ Purpose
  ──────────────────────────────────────────────────────┼─────────────────────────────────────────┼────────────────────────────────────────
    zod                                                 │ shared                                  │ Schema validation
    unified/remark-parse/remark-frontmatter/remark-mdx  │ normalizer                              │ Markdown AST parsing
    yaml                                                │ normalizer                              │ YAML frontmatter parsing
    cheerio                                             │ normalizer (html), crawler              │ HTML parsing
    turndown                                            │ normalizer (html)                       │ HTML→Markdown conversion
    commander                                           │ cli                                     │ CLI framework
    vitest                                              │ all                                     │ Test framework
    esbuild                                             │ cli                                     │ Bundle for distribution
  ──────                                                                                                                                   
  ## 6. CI Configuration                                                                                                                   
                                                                                                                                           
  ###  .github/workflows/ci.yml :                                                                                                          
                                                                                                                                           
  • Runs on push to  master  and all PRs                                                                                                   
  • Matrix: Ubuntu (Node 20, 22) + Windows (Node 20)                                                                                       
  • Steps:  install → audit → build → typecheck → test → regression:fixtures → docs:build → pack:verify → smoke:bundle → install-packed-cli
  → release-smoke                                                                                                                          
                                                                                                                                           
  ###  .github/workflows/release.yml :                                                                                                     
                                                                                                                                           
  • Triggered on version tags ( v* )                                                                                                       
  • Builds, tests, publishes to npm                                                                                                        
  • Creates GitHub release                                                                                                                 
                                                                                                                                           
  ###  .github/workflows/pages.yml :                                                                                                       
                                                                                                                                           
  • Deploys docs site to GitHub Pages on push to master                                                                                    
                                                                                                                                           
  ### CI Gaps:                                                                                                                             
                                                                                                                                           
  1. No dev branch CI: CI only runs on  master  push, not  dev                                                                             
  2. No regression against real documentation projects (the  regression:fixtures  script exists but uses synthetic fixtures)               
  3. No MCP protocol conformance test in CI                                                                                                
  4. No snapshot update validation (snapshots could drift)                                                                                 
  ──────                                                                                                                                   
  ## 7. Snapshot Files                                                                                                                     
                                                                                                                                           
  The generator has snapshots in  packages/generator/src/__snapshots__/ :                                                                  
                                                                                                                                           
  •  generator.test.ts.snap  — contains golden output for generated AGENTS.md, llms.txt, task pack markdown, and agent-map JSON            
                                                                                                                                           
  These snapshots validate the complete artifact generation pipeline output format.  
