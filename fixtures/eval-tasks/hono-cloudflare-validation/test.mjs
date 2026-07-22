import assert from 'node:assert/strict';
import defaultApp, { app } from './app.js';

assert.equal(defaultApp, app, 'default export must be the same Hono app as named export');
assert.equal(typeof app.request, 'function', 'Hono app must expose request()');

const health = await app.request('/health');
assert.equal(health.status, 200);
assert.deepEqual(await health.json(), { ok: true });

const ok = await app.request('/users', {
  method: 'POST',
  body: JSON.stringify({ username: 'alice', age: 31 }),
  headers: { 'content-type': 'application/json' },
});
assert.equal(ok.status, 201);
assert.deepEqual(await ok.json(), { id: 'user_alice', username: 'alice', age: 31 });

for (const payload of [
  { username: 'al', age: 31 },
  { username: 'alice', age: 17 },
  { username: 'alice' },
]) {
  const res = await app.request('/users', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'content-type': 'application/json' },
  });
  assert.equal(res.status, 400, `expected validation failure for ${JSON.stringify(payload)}`);
}

const source = await import('node:fs').then((fs) => fs.readFileSync('./app.js', 'utf8'));
assert.match(source, /hono\/validator/, 'must use the documented hono/validator middleware');
assert.doesNotMatch(source, /listen\s*\(/, 'must not call listen() for Cloudflare Workers');
assert.doesNotMatch(source, /express|fastify|node:http/, 'must not use another server framework');
console.log('PASS: Hono Cloudflare validation task');