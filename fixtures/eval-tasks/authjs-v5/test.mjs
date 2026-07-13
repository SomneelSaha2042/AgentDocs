import fs from "node:fs";
import path from "node:path";

const requiredFiles = [
  "auth.ts",
  "app/api/auth/[...nextauth]/route.ts",
  "app/actions.ts",
];
const missing = requiredFiles.filter((file) => {
  const fullPath = path.join(process.cwd(), file);
  return !fs.existsSync(fullPath) || fs.statSync(fullPath).size === 0;
});

if (missing.length > 0) {
  console.error(`FAIL: Missing implementation files: ${missing.join(", ")}`);
  process.exit(1);
}
console.log("PASS: Auth.js implementation files exist.");
