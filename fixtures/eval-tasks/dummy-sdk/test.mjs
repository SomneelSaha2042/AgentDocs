import { handleWebhook } from './app.js';
import assert from 'node:assert';

assert.strictEqual(handleWebhook("test", "test-secret", "secret"), true);
assert.strictEqual(handleWebhook("test", "bad", "secret"), false);
console.log("PASS");
