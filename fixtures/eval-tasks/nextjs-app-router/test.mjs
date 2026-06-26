import fs from 'node:fs';

const pagesExists = fs.existsSync('./src/pages/about.tsx');
const appExists = fs.existsSync('./src/app/about/page.tsx');

if (pagesExists) {
  console.error("FAIL: src/pages/about.tsx still exists. It should be deleted.");
  process.exit(1);
}

if (!appExists) {
  console.error("FAIL: src/app/about/page.tsx was not created.");
  process.exit(1);
}

const content = fs.readFileSync('./src/app/about/page.tsx', 'utf8');

if (content.includes('getServerSideProps')) {
  console.error("FAIL: Should not use getServerSideProps in App Router.");
  process.exit(1);
}

if (!content.includes('await fetch(')) {
  console.error("FAIL: Should fetch data directly in the Server Component.");
  process.exit(1);
}

console.log("PASS: Migration successful.");
process.exit(0);
