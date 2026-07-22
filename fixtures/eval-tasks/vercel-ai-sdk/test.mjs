import fs from 'fs';
import path from 'path';

const file = path.join(process.cwd(), 'app/api/chat/route.ts');
if (!fs.existsSync(file)) {
  console.error("FAIL: app/api/chat/route.ts does not exist.");
  process.exit(1);
}

const content = fs.readFileSync(file, 'utf8');

if (!content.includes('streamObject')) {
  console.error("FAIL: Did not use streamObject.");
  process.exit(1);
}

if (!content.includes('@ai-sdk/openai')) {
  console.error("FAIL: Did not import from @ai-sdk/openai.");
  process.exit(1);
}

if (!content.includes('recipeName') || !content.includes('ingredients')) {
  console.error("FAIL: Did not define correct schema.");
  process.exit(1);
}

if (!content.includes('You are a master chef.')) {
  console.error("FAIL: Did not use system prompt.");
  process.exit(1);
}

console.log("PASS: Vercel AI SDK route handler looks correct.");
