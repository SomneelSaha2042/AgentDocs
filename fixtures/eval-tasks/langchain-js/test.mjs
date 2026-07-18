import fs from "node:fs";
import path from "node:path";

const indexFile = path.join(process.cwd(), "index.js");
if (!fs.existsSync(indexFile) || fs.statSync(indexFile).size === 0) {
  console.error("FAIL: Missing index.js");
  process.exit(1);
}
console.log("PASS: LangChain implementation file exists.");
