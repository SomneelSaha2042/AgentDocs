import { setupApp } from './app.js';
import assert from 'node:assert';

const app = await setupApp();

// Test 1: Successful validation
const resOk = await app.inject({
  method: 'POST',
  url: '/submit',
  payload: { username: 'alice', age: 20 }
});
assert.strictEqual(resOk.statusCode, 200);
const bodyOk = JSON.parse(resOk.body);
assert.deepStrictEqual(bodyOk, { status: "ok" });

// Test 2: Failed validation - username too short
const resShortUser = await app.inject({
  method: 'POST',
  url: '/submit',
  payload: { username: 'al', age: 20 }
});
assert.strictEqual(resShortUser.statusCode, 400);

// Test 3: Failed validation - age too young
const resYoung = await app.inject({
  method: 'POST',
  url: '/submit',
  payload: { username: 'alice', age: 17 }
});
assert.strictEqual(resYoung.statusCode, 400);

// Test 4: Failed validation - missing properties
const resMissing = await app.inject({
  method: 'POST',
  url: '/submit',
  payload: { username: 'alice' }
});
assert.strictEqual(resMissing.statusCode, 400);

console.log("PASS");
