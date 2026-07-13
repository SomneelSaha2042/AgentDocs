import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

export async function validateFixtureSnapshot(taskDir) {
  const manifestPath = path.join(taskDir, "fixture.manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const docsDir = path.join(taskDir, "docs");
  const files = (await readdir(docsDir))
    .filter((file) => file.endsWith(".md"))
    .sort();
  const hash = createHash("sha256");
  let byteCount = 0;
  const contents = [];
  for (const file of files) {
    const content = await readFile(path.join(docsDir, file));
    byteCount += content.length;
    hash.update(file);
    hash.update("\0");
    hash.update(content);
    hash.update("\0");
    contents.push(content.toString("utf8"));
  }
  const corpusHash = hash.digest("hex");
  const haystack = contents.join("\n").toLowerCase();
  const requiredEvidence = manifest.evaluation?.requiredEvidence ?? [];
  const missingEvidence = requiredEvidence.filter(
    (term) => !haystack.includes(String(term).toLowerCase()),
  );
  const requiredFiles = [
    "fixture.manifest.json",
    "task.md",
    "test.mjs",
    "package.json",
    "evaluation/private-test.mjs",
  ];
  const filePresence = await Promise.all(requiredFiles.map((file) => exists(path.join(taskDir, file))));
  const missingRequiredFiles = requiredFiles.filter((file, index) => !filePresence[index]);
  const source = manifest.source ?? {};
  const issues = [];
  const packageJson = JSON.parse(await readFile(path.join(taskDir, "package.json"), "utf8"));
  const dependencyRanges = Object.entries({
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.devDependencies ?? {}),
  }).filter(([, version]) => typeof version === "string" && /^[~^*]|latest$/i.test(version));
  if (source.format !== "markdown") issues.push("source format must be markdown");
  if (files.length !== source.pageCount) issues.push(`page count mismatch: ${files.length} != ${source.pageCount}`);
  if (byteCount !== source.byteCount) issues.push(`byte count mismatch: ${byteCount} != ${source.byteCount}`);
  if (corpusHash !== source.corpusHash) issues.push("corpus hash mismatch");
  if (missingEvidence.length > 0) issues.push(`missing required evidence: ${missingEvidence.join(", ")}`);
  if (dependencyRanges.length > 0) issues.push(`dependency versions must be exact: ${dependencyRanges.map(([name]) => name).join(", ")}`);
  if (missingRequiredFiles.length > 0) issues.push(`missing fixture files: ${missingRequiredFiles.join(", ")}`);
  return {
    task: manifest.task,
    valid: issues.length === 0,
    issues,
    pageCount: files.length,
    byteCount,
    corpusHash,
    missingEvidence,
  };
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

if (process.argv[1]?.endsWith("eval-fixtures.mjs")) {
  const taskName = process.argv[process.argv.indexOf("--task") + 1];
  if (!taskName) {
    console.error("Usage: node scripts/eval-fixtures.mjs --task <task>");
    process.exit(1);
  }
  const taskDir = path.resolve("fixtures", "eval-tasks", taskName);
  const result = await validateFixtureSnapshot(taskDir);
  console.log(JSON.stringify(result, null, 2));
  if (!result.valid) process.exit(1);
}
