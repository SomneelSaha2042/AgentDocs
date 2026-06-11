import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const distDir = resolve("docs/.vitepress/dist");
const siteBase = "/AgentDocs/";

function collectHtmlFiles(directory) {
  return readdirSync(directory)
    .flatMap((name) => {
      const path = join(directory, name);
      return statSync(path).isDirectory() ? collectHtmlFiles(path) : [path];
    })
    .filter((path) => path.endsWith(".html"));
}

function targetForHref(href) {
  const pathname = href.split(/[?#]/, 1)[0];
  if (!pathname.startsWith(siteBase)) {
    return undefined;
  }

  const relativePath = pathname.slice(siteBase.length);
  return relativePath === "" || relativePath.endsWith("/")
    ? join(distDir, relativePath, "index.html")
    : join(distDir, relativePath);
}

const missingLinks = [];

for (const htmlFile of collectHtmlFiles(distDir)) {
  const html = readFileSync(htmlFile, "utf8");
  for (const match of html.matchAll(/href="([^"]+)"/g)) {
    const href = match[1];
    const target = targetForHref(href);
    if (target && !existsSync(target)) {
      missingLinks.push(`${relative(distDir, htmlFile)} -> ${href}`);
    }
  }
}

if (missingLinks.length > 0) {
  console.error("Generated documentation contains missing internal links:");
  for (const link of missingLinks) {
    console.error(`- ${link}`);
  }
  process.exitCode = 1;
} else {
  console.log("Generated documentation internal links resolve to deployed files.");
}
