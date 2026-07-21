import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  AgentMapSchema,
  SearchDocumentSchema,
  SearchIndexFallbackSchema,
  SearchResponseSchema,
  SearchResultSchema,
  type AgentMap,
  type SearchDocument,
  type SearchResponse,
  type SearchResult,
} from "@agentdocs/shared";

export type BuildSearchIndexOptions = {
  agentMap: AgentMap;
  cwd: string;
  out: string;
  preferredFacets?: Record<string, string>;
  exclusiveKeys?: string[];
};

export type BuildSearchIndexResult = {
  backend: "sqlite-fts5" | "lexical";
  documentCount: number;
  indexPath: string;
};

export type SearchIndexOptions = {
  cwd: string;
  limit?: number;
  out: string;
  query: string;
  facets?: Record<string, string>;
  task?: string;
};

export type SearchIndexReader = {
  search(options: Omit<SearchIndexOptions, "cwd" | "out">): Promise<SearchResponse>;
  close(): void;
};

type IndexData = {
  documents: SearchDocument[];
  preferredFacets: Record<string, string>;
  exclusiveKeys: string[];
};

type SqliteDatabase = {
  close(): void;
  exec(sql: string): void;
  prepare(sql: string): {
    all(...values: unknown[]): unknown[];
    run(...values: unknown[]): unknown;
  };
};

type SqliteModule = {
  DatabaseSync: new (path: string) => SqliteDatabase;
};

export class SearchIndexError extends Error {
  override readonly name = "SearchIndexError";
}

export async function buildSearchIndex(
  options: BuildSearchIndexOptions,
): Promise<BuildSearchIndexResult> {
  const agentMap = AgentMapSchema.parse(options.agentMap);
  const indexPath = path.resolve(options.cwd, options.out, "index.sqlite");
  const stagingPath = `${indexPath}.tmp`;
  const documents = buildDocuments(agentMap);
  await removeIfPresent(stagingPath);

  const sqlite = await loadSqlite();
  if (sqlite !== undefined) {
    try {
      writeSqliteIndex(sqlite, stagingPath, documents, options.preferredFacets ?? {}, options.exclusiveKeys ?? []);
      await replaceIndex(stagingPath, indexPath);
      return { backend: "sqlite-fts5", documentCount: documents.length, indexPath };
    } catch (error) {
      if (!isMissingFts5(error)) {
        await removeIfPresent(stagingPath);
        const message = error instanceof Error ? error.message : String(error);
        throw new SearchIndexError(`Could not write search index at ${indexPath}: ${message}`);
      }
      await removeIfPresent(stagingPath);
    }
  }

  const fallback = SearchIndexFallbackSchema.parse({
    schemaVersion: 1,
    backend: "lexical",
    documents,
    preferredFacets: options.preferredFacets ?? {},
    exclusiveKeys: options.exclusiveKeys ?? [],
  });
  await writeFile(stagingPath, `${JSON.stringify(fallback)}\n`, "utf8");
  await replaceIndex(stagingPath, indexPath);
  return { backend: "lexical", documentCount: documents.length, indexPath };
}

export async function searchIndex(
  options: SearchIndexOptions,
): Promise<SearchResponse> {
  const reader = await openSearchIndex({ cwd: options.cwd, out: options.out });
  try {
    return await reader.search(options);
  } finally {
    reader.close();
  }
}

export async function openSearchIndex(options: Pick<SearchIndexOptions, "cwd" | "out">): Promise<SearchIndexReader> {
  const indexPath = path.resolve(options.cwd, options.out, "index.sqlite");
  let contents: Buffer;
  try {
    contents = await readFile(indexPath);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new SearchIndexError(
        `Search index not found at ${indexPath}. Run "agentdocs build --skip-crawl" first.`,
      );
    }
    throw error;
  }

  if (isSqlite(contents)) {
    return createSqliteReader(indexPath);
  }
  const data = readFallbackDocuments(contents, indexPath);
  return createLexicalReader(data);
}

function createLexicalReader(data: IndexData): SearchIndexReader {
  return {
    async search(options) {
      const limit = validateSearchLimit(options.limit);
      const documents = data.documents.filter((document) =>
        matchesFacetFilters(document, options.facets ?? {})
        && (options.task === undefined || document.taskPackIds.includes(options.task)),
      );
      const results = diversifyResults(rankDocuments(
        documents,
        options.query,
        data.preferredFacets,
        data.exclusiveKeys,
      ), limit);
      return SearchResponseSchema.parse({
        query: options.query,
        results,
        warnings: contextWarnings(results, data.exclusiveKeys),
      });
    },
    close() {
      // The lexical fallback is an immutable in-memory snapshot.
    },
  };
}

function createSqliteReader(indexPath: string): SearchIndexReader {
  const sqliteModulePromise = loadSqlite();
  let database: SqliteDatabase | undefined;
  let metadata: IndexData | undefined;
  let closed = false;
  const ensureDatabase = async (): Promise<{ database: SqliteDatabase; data: IndexData }> => {
    if (closed) throw new SearchIndexError("Search index reader is closed.");
    if (database !== undefined && metadata !== undefined) return { database, data: metadata };
    const sqlite = await sqliteModulePromise;
    if (sqlite === undefined) {
      throw new SearchIndexError(
        `The index at ${indexPath} uses SQLite, but this Node.js runtime does not provide node:sqlite. Rebuild with this runtime to create the lexical fallback index.`,
      );
    }
    database = new sqlite.DatabaseSync(indexPath);
    try {
      const rows = database.prepare("SELECT key, value FROM metadata ORDER BY key").all() as Record<string, unknown>[];
      const values = Object.fromEntries(rows.map((row) => [String(row.key), String(row.value)]));
      if (values.schema_version !== "2" || values.backend !== "sqlite-fts5") {
        throw new SearchIndexError(
          `Unsupported search index metadata: schema_version=${values.schema_version ?? "missing"}, backend=${values.backend ?? "missing"}.`,
        );
      }
      metadata = {
        preferredFacets: JSON.parse(values.preferred_facets ?? "{}"),
        exclusiveKeys: JSON.parse(values.exclusive_keys ?? "[]"),
        documents: [],
      };
      return { database, data: metadata };
    } catch (error) {
      database.close();
      database = undefined;
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof SearchIndexError) throw error;
      throw new SearchIndexError(`Invalid search index at ${indexPath}: ${message}`);
    }
  };
  return {
    async search(options) {
      const limit = validateSearchLimit(options.limit);
      const { database: db, data } = await ensureDatabase();
      const candidates = sqliteCandidates(db, options.query, options.facets ?? {}, options.task, Math.max(64, limit * 8));
      const results = diversifyResults(rankDocuments(
        candidates,
        options.query,
        data.preferredFacets,
        data.exclusiveKeys,
      ), limit);
      return SearchResponseSchema.parse({
        query: options.query,
        results,
        warnings: contextWarnings(results, data.exclusiveKeys),
      });
    },
    close() {
      if (closed) return;
      closed = true;
      database?.close();
      database = undefined;
      metadata = undefined;
    },
  };
}

function validateSearchLimit(limit: number | undefined): number {
  const value = limit ?? 10;
  if (!Number.isInteger(value) || value < 1) {
    throw new SearchIndexError("Search result limit must be a positive integer.");
  }
  return value;
}

function sqliteCandidates(
  database: SqliteDatabase,
  query: string,
  facets: Record<string, string>,
  task: string | undefined,
  candidateLimit: number,
): SearchDocument[] {
  const terms = stableUnique(tokenize(oneLine(query)));
  if (terms.length === 0) return [];
  const match = terms.map((term) => `"${term.replaceAll('"', '""')}"*`).join(" OR ");
  const facetEntries = Object.entries(facets);
  const conditions = ["search_fts MATCH ?"];
  const values: unknown[] = [match];
  if (task !== undefined) {
    conditions.push("EXISTS (SELECT 1 FROM json_each(documents.task_pack_ids_json) WHERE json_each.value = ?)");
    values.push(task);
  }
  for (const [key, value] of facetEntries) {
    conditions.push("EXISTS (SELECT 1 FROM json_each(documents.facets_json) WHERE json_extract(json_each.value, '$.key') = ? AND json_extract(json_each.value, '$.value') = ?)");
    values.push(key, value);
  }
  values.push(candidateLimit);
  try {
    let rows = database.prepare(`
      SELECT
        documents.page_id,
        documents.chunk_id,
        documents.title,
        documents.source_url,
        documents.repo_path,
        documents.heading_path,
        documents.text,
        documents.content_hash,
        documents.facets_json,
        documents.task_pack_ids_json
      FROM search_fts
      JOIN search_documents AS documents ON documents.rowid = search_fts.rowid
      WHERE ${conditions.join(" AND ")}
      ORDER BY bm25(search_fts, 12.0, 8.0, 1.0) ASC, documents.chunk_id ASC
      LIMIT ?
    `).all(...values) as Record<string, unknown>[];
    if (rows.length === 0) {
      const taskValue = task ?? oneLine(query).toLowerCase();
      const taskValues: unknown[] = [taskValue];
      const taskConditions = ["EXISTS (SELECT 1 FROM json_each(documents.task_pack_ids_json) WHERE lower(json_each.value) = ?)"];
      for (const [key, value] of facetEntries) {
        taskConditions.push("EXISTS (SELECT 1 FROM json_each(documents.facets_json) WHERE json_extract(json_each.value, '$.key') = ? AND json_extract(json_each.value, '$.value') = ?)");
        taskValues.push(key, value);
      }
      taskValues.push(candidateLimit);
      rows = database.prepare(`
        SELECT
          documents.page_id,
          documents.chunk_id,
          documents.title,
          documents.source_url,
          documents.repo_path,
          documents.heading_path,
          documents.text,
          documents.content_hash,
          documents.facets_json,
          documents.task_pack_ids_json
        FROM search_documents AS documents
        WHERE ${taskConditions.join(" AND ")}
        ORDER BY documents.chunk_id ASC
        LIMIT ?
      `).all(...taskValues) as Record<string, unknown>[];
    }
    return rows.map((row) => SearchDocumentSchema.parse({
      pageId: row.page_id,
      chunkId: row.chunk_id,
      title: row.title,
      sourceUrl: row.source_url ?? undefined,
      repoPath: row.repo_path ?? undefined,
      headingPath: JSON.parse(String(row.heading_path)),
      text: row.text,
      contentHash: row.content_hash,
      facets: JSON.parse(String(row.facets_json)),
      taskPackIds: JSON.parse(String(row.task_pack_ids_json)),
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new SearchIndexError(`Invalid search query for ${message}`);
  }
}

export function formatSearchResponse(response: SearchResponse): string {
  if (response.results.length === 0) {
    return `No results found for "${response.query}".\n`;
  }
  const warnings = response.warnings.map((warning) =>
    `WARNING: ${warning.code} ${warning.key}=${warning.values.join(",")}`).join("\n");
  return `${warnings.length === 0 ? "" : `${warnings}\n\n`}${response.results.map((result, index) => {
    const source = result.sourceUrl ?? result.repoPath ?? "Unknown source";
    const heading = result.headingPath.length === 0
      ? ""
      : ` > ${result.headingPath.join(" > ")}`;
    const facets = result.facets.length === 0
      ? ""
      : ` facets=${result.facets.map((facet) => `${facet.key}=${facet.value}`).join(",")}`;
    return `${index + 1}. ${result.title}${heading}\n   ${source}\n   score=${result.score} page=${result.pageId} chunk=${result.chunkId}${facets}\n   ${result.snippet}`;
  }).join("\n\n")}\n`;
}

function buildDocuments(agentMap: AgentMap): SearchDocument[] {
  const pages = new Map(agentMap.pages.map((page) => [page.id, page]));
  const taskPacksByPage = new Map<string, string[]>();
  for (const pack of agentMap.taskPacks) {
    for (const pageId of pack.requiredPages) {
      taskPacksByPage.set(pageId, [...(taskPacksByPage.get(pageId) ?? []), pack.id].sort(compareStrings));
    }
  }
  return agentMap.chunks
    .map((chunk) => {
      const page = pages.get(chunk.pageId);
      if (page === undefined) {
        throw new SearchIndexError(
          `Chunk ${chunk.id} references missing page ${chunk.pageId}.`,
        );
      }
      return SearchDocumentSchema.parse({
        pageId: page.id,
        chunkId: chunk.id,
        title: page.title,
        sourceUrl: page.canonicalUrl ?? page.sourceUrl,
        repoPath: page.repoPath,
        headingPath: chunk.headingPath,
        text: chunk.text,
        contentHash: chunk.contentHash,
        facets: chunk.facets,
        taskPackIds: taskPacksByPage.get(page.id) ?? [],
      });
    })
    .sort((left, right) => compareStrings(left.chunkId, right.chunkId));
}

async function loadSqlite(): Promise<SqliteModule | undefined> {
  try {
    return await import("node:sqlite") as unknown as SqliteModule;
  } catch (error) {
    if (
      error instanceof Error
      && "code" in error
      && (error.code === "ERR_UNKNOWN_BUILTIN_MODULE" || error.code === "ERR_MODULE_NOT_FOUND")
    ) {
      return undefined;
    }
    throw error;
  }
}

function writeSqliteIndex(
  sqlite: SqliteModule,
  indexPath: string,
  documents: SearchDocument[],
  preferredFacets: Record<string, string>,
  exclusiveKeys: string[],
): void {
  const database = new sqlite.DatabaseSync(indexPath);
  try {
    database.exec(`
      PRAGMA journal_mode = DELETE;
      PRAGMA synchronous = FULL;
      CREATE TABLE metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE search_documents (
        rowid INTEGER PRIMARY KEY,
        page_id TEXT NOT NULL,
        chunk_id TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        source_url TEXT,
        repo_path TEXT,
        heading_path TEXT NOT NULL,
        text TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        facets_json TEXT NOT NULL,
        task_pack_ids_json TEXT NOT NULL
      );
      CREATE VIRTUAL TABLE search_fts USING fts5(
        title,
        heading_path,
        text,
        content='search_documents',
        content_rowid='rowid'
      );
      INSERT INTO metadata(key, value) VALUES ('schema_version', '2');
      INSERT INTO metadata(key, value) VALUES ('backend', 'sqlite-fts5');
      INSERT INTO metadata(key, value) VALUES ('preferred_facets', '${escapeSql(JSON.stringify(preferredFacets))}');
      INSERT INTO metadata(key, value) VALUES ('exclusive_keys', '${escapeSql(JSON.stringify(exclusiveKeys))}');
    `);
    const insertDocument = database.prepare(`
      INSERT INTO search_documents(
        rowid, page_id, chunk_id, title, source_url, repo_path, heading_path, text, content_hash, facets_json, task_pack_ids_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertFts = database.prepare(`
      INSERT INTO search_fts(rowid, title, heading_path, text) VALUES (?, ?, ?, ?)
    `);
    documents.forEach((document, index) => {
      const rowid = index + 1;
      const headingPath = JSON.stringify(document.headingPath);
      insertDocument.run(
        rowid,
        document.pageId,
        document.chunkId,
        document.title,
        document.sourceUrl ?? null,
        document.repoPath ?? null,
        headingPath,
        document.text,
        document.contentHash,
        JSON.stringify(document.facets),
        JSON.stringify(document.taskPackIds),
      );
      insertFts.run(rowid, document.title, headingPath, document.text);
    });
    database.exec("VACUUM;");
  } finally {
    database.close();
  }
}

async function readSqliteDocuments(
  indexPath: string,
): Promise<IndexData> {
  const sqlite = await loadSqlite();
  if (sqlite === undefined) {
    throw new SearchIndexError(
      `The index at ${indexPath} uses SQLite, but this Node.js runtime does not provide node:sqlite. Rebuild with this runtime to create the lexical fallback index.`,
    );
  }
  const database = new sqlite.DatabaseSync(indexPath);
  try {
    const metadata = database.prepare(`
      SELECT key, value FROM metadata ORDER BY key
    `).all() as Record<string, unknown>[];
    const values = Object.fromEntries(
      metadata.map((row) => [String(row.key), String(row.value)]),
    );
    if (values.schema_version !== "2" || values.backend !== "sqlite-fts5") {
      throw new SearchIndexError(
        `Unsupported search index metadata: schema_version=${values.schema_version ?? "missing"}, backend=${values.backend ?? "missing"}.`,
      );
    }
    const rows = database.prepare(`
      SELECT
        documents.page_id,
        documents.chunk_id,
        documents.title,
        documents.source_url,
        documents.repo_path,
        documents.heading_path,
        documents.text,
        documents.content_hash,
        documents.facets_json,
        documents.task_pack_ids_json
      FROM search_documents AS documents
      ORDER BY documents.chunk_id
    `).all() as Record<string, unknown>[];
    return {
      preferredFacets: JSON.parse(values.preferred_facets ?? "{}"),
      exclusiveKeys: JSON.parse(values.exclusive_keys ?? "[]"),
      documents: rows.map((row) => SearchDocumentSchema.parse({
      pageId: row.page_id,
      chunkId: row.chunk_id,
      title: row.title,
      sourceUrl: row.source_url ?? undefined,
      repoPath: row.repo_path ?? undefined,
      headingPath: JSON.parse(String(row.heading_path)),
      text: row.text,
      contentHash: row.content_hash,
      facets: JSON.parse(String(row.facets_json)),
      taskPackIds: JSON.parse(String(row.task_pack_ids_json)),
    })),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new SearchIndexError(`Invalid search index at ${indexPath}: ${message}`);
  } finally {
    database.close();
  }
}

function readFallbackDocuments(contents: Buffer, indexPath: string): IndexData {
  try {
    const index = SearchIndexFallbackSchema.parse(JSON.parse(contents.toString("utf8")));
    return {
      documents: index.documents,
      preferredFacets: index.preferredFacets,
      exclusiveKeys: index.exclusiveKeys,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new SearchIndexError(`Invalid search index at ${indexPath}: ${message}`);
  }
}

function rankDocuments(
  documents: SearchDocument[],
  query: string,
  preferredFacets: Record<string, string>,
  exclusiveKeys: string[],
): SearchResult[] {
  const compactQuery = oneLine(query).toLowerCase();
  const queryTerms = tokenize(compactQuery);
  const uniqueTerms = stableUnique(queryTerms);
  if (uniqueTerms.length === 0) {
    return [];
  }
  const distinctiveness = termDistinctiveness(documents, uniqueTerms);
  const namedFacets = queryNamedFacets(documents, compactQuery, exclusiveKeys);
  return documents
    .map((document) => {
      const title = document.title.toLowerCase();
      const heading = document.headingPath.join(" ").toLowerCase();
      const text = document.text.toLowerCase();
      const titleTerms = tokenize(title);
      const headingTerms = tokenize(heading);
      const textTerms = tokenize(text);
      let score = 0;
      for (const term of uniqueTerms) {
        const weight = termWeight(term) * (distinctiveness.get(term) ?? 1);
        score += Math.min(countPrefixMatches(titleTerms, term), 2) * 8 * weight;
        score += Math.min(countPrefixMatches(headingTerms, term), 2) * 4 * weight;
        score += Math.min(countPrefixMatches(textTerms, term), 3) * weight;
      }
      score += containsTokenSequence(titleTerms, queryTerms) ? 20 : 0;
      score += containsTokenSequence(headingTerms, queryTerms) ? 10 : 0;
      score += containsTokenSequence(textTerms, queryTerms) ? 3 : 0;
      score += document.taskPackIds.includes(compactQuery) ? 40 : 0;
      score += contentTypeScore(document, compactQuery);
      score += facetPreferenceScore(document, preferredFacets, 3);
      score += facetPreferenceScore(document, namedFacets, 30);
      return SearchResultSchema.parse({
        title: document.title,
        sourceUrl: document.sourceUrl,
        repoPath: document.repoPath,
        headingPath: document.headingPath,
        snippet: snippet(document.text, uniqueTerms),
        score: Math.max(0, score),
        pageId: document.pageId,
        chunkId: document.chunkId,
        facets: document.facets,
      });
    })
    .filter((result) => result.score > 0)
    .sort((left, right) =>
      right.score - left.score
      || compareStrings(left.pageId, right.pageId)
      || compareStrings(left.chunkId, right.chunkId));
}

function termDistinctiveness(documents: SearchDocument[], terms: string[]): Map<string, number> {
  const pageIds = new Set(documents.map((document) => document.pageId));
  const pagesByTerm = new Map(terms.map((term) => [term, new Set<string>()]));
  for (const document of documents) {
    const tokens = tokenize(
      `${document.title} ${document.headingPath.join(" ")} ${document.text}`.toLowerCase(),
    );
    for (const term of terms) {
      if (tokens.some((token) => token.startsWith(term))) {
        pagesByTerm.get(term)!.add(document.pageId);
      }
    }
  }
  return new Map(terms.map((term) => {
    const documentFrequency = pagesByTerm.get(term)?.size ?? 0;
    return [term, Math.log((pageIds.size + 1) / (documentFrequency + 1)) + 0.25];
  }));
}

function diversifyResults(results: SearchResult[], limit: number): SearchResult[] {
  const selected: SearchResult[] = [];
  const selectedChunks = new Set<string>();
  const pages = new Set<string>();
  for (const result of results) {
    if (selected.length >= limit) break;
    if (!pages.has(result.pageId)) {
      selected.push(result);
      selectedChunks.add(result.chunkId);
      pages.add(result.pageId);
    }
  }
  for (const result of results) {
    if (selected.length >= limit) break;
    if (!selectedChunks.has(result.chunkId)) {
      selected.push(result);
      selectedChunks.add(result.chunkId);
    }
  }
  return selected;
}

function matchesFacetFilters(
  document: SearchDocument,
  filters: Record<string, string>,
): boolean {
  return Object.entries(filters).every(([key, value]) =>
    document.facets.some((facet) => facet.key === key && facet.value === value));
}

function queryNamedFacets(
  documents: SearchDocument[],
  query: string,
  exclusiveKeys: string[],
): Record<string, string> {
  const named: Record<string, string> = {};
  for (const key of exclusiveKeys) {
    const values = stableUnique(documents.flatMap((document) =>
      document.facets.filter((facet) => facet.key === key).map((facet) => facet.value)));
    const matches = values.filter((value) => query.includes(value.toLowerCase()));
    if (matches.length === 1) named[key] = matches[0]!;
  }
  return named;
}

function facetPreferenceScore(
  document: SearchDocument,
  preferred: Record<string, string>,
  weight: number,
): number {
  return Object.entries(preferred).reduce((score, [key, value]) => {
    const values = document.facets.filter((facet) => facet.key === key).map((facet) => facet.value);
    return values.length === 0 ? score : score + (values.includes(value) ? weight : -weight);
  }, 0);
}

function contentTypeScore(document: SearchDocument, query: string): number {
  const values = document.facets
    .filter((facet) => facet.key === "content_type")
    .map((facet) => facet.value);
  if (values.length === 0) {
    return 0;
  }
  const implementationGoal = isImplementationGoal(query);
  const explicitHistoricalGoal = /\b(?:blog|news|release|releases|changelog|change\s+log|what'?s new)\b/i.test(query);
  return values.reduce((score, value) => {
    if (explicitHistoricalGoal && ["blog", "news", "release"].includes(value)) {
      return score + 10;
    }
    if (!implementationGoal) {
      return score;
    }
    if (["docs", "tutorial", "reference"].includes(value)) return score + 8;
    if (value === "example") return score + 3;
    if (["blog", "news", "release"].includes(value)) return score - 18;
    return score;
  }, 0);
}

function isImplementationGoal(query: string): boolean {
  return /\b(?:api|auth|authenticate|authentication|build|configure|configuration|create|debug|deploy|deployment|error|errors|example|implement|install|installation|migration|pagination|quickstart|route|setup|test|tutorial|use|using|webhook|workflow)\b/i
    .test(query);
}

function contextWarnings(results: SearchResult[], exclusiveKeys: string[]) {
  return exclusiveKeys.flatMap((key) => {
    const values = stableUnique(results.flatMap((result) =>
      result.facets.filter((facet) => facet.key === key).map((facet) => facet.value)));
    return values.length < 2 ? [] : [{ code: "context_conflict" as const, key, values }];
  });
}

function termWeight(term: string): number {
  return new Set([
    "a", "an", "and", "application", "client", "create", "for", "how", "in",
    "of", "the", "to", "use", "using", "with",
  ]).has(term) ? 0.25 : 1;
}

function snippet(value: string, terms: string[]): string {
  const compact = oneLine(value);
  const lower = compact.toLowerCase();
  const firstMatch = terms
    .map((term) => lower.indexOf(term))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0] ?? 0;
  const start = Math.max(0, firstMatch - 60);
  const end = Math.min(compact.length, start + 220);
  return `${start > 0 ? "..." : ""}${compact.slice(start, end)}${end < compact.length ? "..." : ""}`;
}

function tokenize(value: string): string[] {
  return value.match(/[\p{L}\p{N}][\p{L}\p{N}_./:@-]*/gu) ?? [];
}

function countPrefixMatches(values: string[], term: string): number {
  return values.filter((value) => value.startsWith(term)).length;
}

function containsTokenSequence(values: string[], query: string[]): boolean {
  if (query.length === 0 || query.length > values.length) {
    return false;
  }
  for (let index = 0; index <= values.length - query.length; index += 1) {
    if (query.every((term, offset) => values[index + offset] === term)) {
      return true;
    }
  }
  return false;
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stableUnique(values: string[]): string[] {
  return [...new Set(values)].sort(compareStrings);
}

function isSqlite(contents: Buffer): boolean {
  return contents.subarray(0, 16).toString("binary") === "SQLite format 3\u0000";
}

function isMissingFts5(error: unknown): boolean {
  return error instanceof Error && /no such module:\s*fts5/i.test(error.message);
}

async function removeIfPresent(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }
}

async function replaceIndex(stagingPath: string, indexPath: string): Promise<void> {
  await removeIfPresent(indexPath);
  await rename(stagingPath, indexPath);
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function escapeSql(value: string): string {
  return value.replaceAll("'", "''");
}
