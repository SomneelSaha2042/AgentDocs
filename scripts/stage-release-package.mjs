import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const source = path.join(root, "packages", "cli");
const destination = path.join(root, ".release", "package");
const sourcePackage = JSON.parse(await readFile(path.join(source, "package.json"), "utf8"));

await rm(destination, { recursive: true, force: true });
await mkdir(path.join(destination, "dist"), { recursive: true });
await Promise.all([
  copyFile(path.join(source, "dist", "agentdocs.js"), path.join(destination, "dist", "agentdocs.js")),
  copyFile(path.join(source, "LICENSE"), path.join(destination, "LICENSE")),
  copyFile(path.join(source, "README.md"), path.join(destination, "README.md")),
]);

const publishedPackage = {
  name: sourcePackage.name,
  version: sourcePackage.version,
  description: sourcePackage.description,
  license: sourcePackage.license,
  author: sourcePackage.author,
  homepage: sourcePackage.homepage,
  repository: sourcePackage.repository,
  bugs: sourcePackage.bugs,
  keywords: sourcePackage.keywords,
  engines: sourcePackage.engines,
  publishConfig: sourcePackage.publishConfig,
  type: sourcePackage.type,
  bin: sourcePackage.bin,
  files: sourcePackage.files,
};
await writeFile(
  path.join(destination, "package.json"),
  `${JSON.stringify(publishedPackage, null, 2)}\n`,
  "utf8",
);
