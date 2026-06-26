import { loadAndValidateConfig } from './app.js';
import assert from 'node:assert';

// Test 1: Valid config
const validYaml = `
name: My Docs Project
slug: my-docs-project
sources:
  - type: local_markdown
    path: ./docs
`;

const config = await loadAndValidateConfig(validYaml);
assert.strictEqual(config.name, "My Docs Project");
assert.strictEqual(config.slug, "my-docs-project");

// Test 2: Invalid config (should return validation error object)
const invalidYaml = `
name: Missing Sources Project
slug: missing-sources-project
`;

const errorResult = await loadAndValidateConfig(invalidYaml);
assert.strictEqual(errorResult.success, false);
assert.ok(errorResult.error.includes("sources") || errorResult.error.includes("invalid"), "Should contain sources validation error message");

console.log("PASS");
