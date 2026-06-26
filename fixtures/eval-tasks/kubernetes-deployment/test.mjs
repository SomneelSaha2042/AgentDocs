import fs from 'node:fs';

const manifestExists = fs.existsSync('./mysql-stateful.yaml');
if (!manifestExists) {
  console.error("FAIL: mysql-stateful.yaml was not created.");
  process.exit(1);
}

const content = fs.readFileSync('./mysql-stateful.yaml', 'utf8');

// Basic validation using regexes
const pvRegex = /kind:\s*PersistentVolume[\s\S]*?name:\s*mysql-pv-volume/;
const pvcRegex = /kind:\s*PersistentVolumeClaim[\s\S]*?name:\s*mysql-pv-claim/;
const svcRegex = /kind:\s*Service[\s\S]*?name:\s*mysql/;
const deployRegex = /kind:\s*Deployment[\s\S]*?name:\s*mysql/;

if (!pvRegex.test(content)) {
  console.error("FAIL: Missing PersistentVolume named 'mysql-pv-volume'.");
  process.exit(1);
}

if (!pvcRegex.test(content)) {
  console.error("FAIL: Missing PersistentVolumeClaim named 'mysql-pv-claim'.");
  process.exit(1);
}

if (!svcRegex.test(content)) {
  console.error("FAIL: Missing Service named 'mysql'.");
  process.exit(1);
}

if (!deployRegex.test(content)) {
  console.error("FAIL: Missing Deployment named 'mysql'.");
  process.exit(1);
}

// Headless service check
if (!content.includes('clusterIP: None')) {
  console.error("FAIL: Service must be headless (clusterIP: None).");
  process.exit(1);
}

// Volume mount reference check
if (!content.includes('claimName: mysql-pv-claim')) {
  console.error("FAIL: Deployment must reference PVC 'mysql-pv-claim'.");
  process.exit(1);
}

// Image check
if (!content.includes('mysql:9')) {
  console.error("FAIL: Deployment must use image 'mysql:9'.");
  process.exit(1);
}

console.log("PASS: Kubernetes MySQL manifest verified successfully.");
process.exit(0);
