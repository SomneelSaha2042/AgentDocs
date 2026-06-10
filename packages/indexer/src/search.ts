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
      writeSqliteIndex(sqlite, stagingPath, documents);
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
  });
  await writeFile(stagingPath, `${JSON.stringify(fallback)}\n`, "utf8");
  await replaceIndex(stagingPath, indexPath);
  return { backend: "lexical", documentCount: documents.length, indexPath };
}

export async function searchIndex(
  options: SearchIndexOptions,
): Promise<SearchResponse> {
  const indexPath = path.resolve(options.cwd, options.out, "index.sqlite");
  const limit = options.limit ?? 10;
  if (!Number.isInteger(limit) || limit < 1) {
    throw new SearchIndexError("Search result limit must be a positive integer.");
  }

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

  const documents = isSqlite(contents)
    ? await readSqliteDocuments(indexPath, options.query)
    : readFallbackDocuments(contents, indexPath);
  return SearchResponseSchema.parse({
    query: options.query,
    results: rankDocuments(documents, options.query).slice(0, limit),
  });
}

export function formatSearchResponse(response: SearchResponse): string {
  if (response.results.length === 0) {
    return `No results found for "${response.query}".\n`;
  }
  return `${response.results.map((result, index) => {
    const source = result.sourceUrl ?? result.repoPath ?? "Unknown source";
    const heading = result.headingPath.length === 0
      ? ""
      : ` > ${result.headingPath.join(" > ")}`;
    return `${index + 1}. ${result.title}${heading}\n   ${source}\n   score=${result.score} page=${result.pageId} chunk=${result.chunkId}\n   ${result.snippet}`;
  }).join("\n\n")}\n`;
}

function buildDocuments(agentMap: AgentMap): SearchDocument[] {
  const pages = new Map(agentMap.pages.map((page) => [page.id, page]));
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
        content_hash TEXT NOT NULL
      );
      CREATE VIRTUAL TABLE search_fts USING fts5(
        title,
        heading_path,
        text,
        content='search_documents',
        content_rowid='rowid'
      );
      INSERT INTO metadata(key, value) VALUES ('schema_version', '1');
      INSERT INTO metadata(key, value) VALUES ('backend', 'sqlite-fts5');
    `);
    const insertDocument = database.prepare(`
      INSERT INTO search_documents(
        rowid, page_id, chunk_id, title, source_url, repo_path, heading_path, text, content_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
  query: string,
): Promise<SearchDocument[]> {
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
    if (values.schema_version !== "1" || values.backend !== "sqlite-fts5") {
      throw new SearchIndexError(
        `Unsupported search index metadata: schema_version=${values.schema_version ?? "missing"}, backend=${values.backend ?? "missing"}.`,
      );
    }
    const terms = stableUnique(tokenize(oneLine(query).toLowerCase()));
    if (terms.length === 0) {
      return [];
    }
    const ftsQuery = terms.map((term) => `"${term}"*`).join(" OR ");
    const rows = database.prepare(`
      SELECT
        documents.page_id,
        documents.chunk_id,
        documents.title,
        documents.source_url,
        documents.repo_path,
        documents.heading_path,
        documents.text,
        documents.content_hash
      FROM search_documents AS documents
      JOIN search_fts ON search_fts.rowid = documents.rowid
      WHERE search_fts MATCH ?
      ORDER BY documents.chunk_id
    `).all(ftsQuery) as Record<string, unknown>[];
    return rows.map((row) => SearchDocumentSchema.parse({
      pageId: row.page_id,
      chunkId: row.chunk_id,
      title: row.title,
      sourceUrl: row.source_url ?? undefined,
      repoPath: row.repo_path ?? undefined,
      headingPath: JSON.parse(String(row.heading_path)),
      text: row.text,
      contentHash: row.content_hash,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new SearchIndexError(`Invalid search index at ${indexPath}: ${message}`);
  } finally {
    database.close();
  }
}

function readFallbackDocuments(contents: Buffer, indexPath: string): SearchDocument[] {
  try {
    return SearchIndexFallbackSchema.parse(JSON.parse(contents.toString("utf8"))).documents;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new SearchIndexError(`Invalid search index at ${indexPath}: ${message}`);
  }
}

function rankDocuments(documents: SearchDocument[], query: string): SearchResult[] {
  const compactQuery = oneLine(query).toLowerCase();
  const queryTerms = tokenize(compactQuery);
  const uniqueTerms = stableUnique(queryTerms);
  if (uniqueTerms.length === 0) {
    return [];
  }
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
        score += countPrefixMatches(titleTerms, term) * 8;
        score += countPrefixMatches(headingTerms, term) * 4;
        score += countPrefixMatches(textTerms, term);
      }
      score += containsTokenSequence(titleTerms, queryTerms) ? 20 : 0;
      score += containsTokenSequence(headingTerms, queryTerms) ? 10 : 0;
      score += containsTokenSequence(textTerms, queryTerms) ? 3 : 0;
      return SearchResultSchema.parse({
        title: document.title,
        sourceUrl: document.sourceUrl,
        repoPath: document.repoPath,
        headingPath: document.headingPath,
        snippet: snippet(document.text, uniqueTerms),
        score,
        pageId: document.pageId,
        chunkId: document.chunkId,
      });
    })
    .filter((result) => result.score > 0)
    .sort((left, right) =>
      right.score - left.score
      || compareStrings(left.pageId, right.pageId)
      || compareStrings(left.chunkId, right.chunkId));
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
