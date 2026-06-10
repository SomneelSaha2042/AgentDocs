import { readFile } from "node:fs/promises";
import path from "node:path";

import { build } from "esbuild";

const packageRoot = path.resolve(import.meta.dirname, "..");
const workspaceRoot = path.resolve(packageRoot, "../..");
const packageJson = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8"));
const internalPackages = [
  "crawler",
  "doctor",
  "generator",
  "graph",
  "indexer",
  "mcp-server",
  "normalizer",
  "shared",
];

await build({
  absWorkingDir: workspaceRoot,
  alias: Object.fromEntries(internalPackages.map((name) => [
    `@agentdocs/${name}`,
    path.join(workspaceRoot, "packages", name, "src", "index.ts"),
  ])),
  banner: {
    js: "import { createRequire as __agentdocsCreateRequire } from 'node:module'; const require = __agentdocsCreateRequire(import.meta.url);",
  },
  bundle: true,
  define: {
    __AGENTDOCS_VERSION__: JSON.stringify(packageJson.version),
  },
  entryPoints: [path.join(packageRoot, "src", "index.ts")],
  format: "esm",
  logLevel: "info",
  minify: false,
  outfile: path.join(packageRoot, "dist", "agentdocs.js"),
  packages: "bundle",
  platform: "node",
  sourcemap: false,
  target: "node20",
});
