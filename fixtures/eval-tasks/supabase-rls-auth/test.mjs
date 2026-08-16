import assert from 'node:assert/strict';
import { createBrowserClient, createAdminClient, getProfile, PROFILES_RLS_POLICY } from './app.js';

const env = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
};

const browser = createBrowserClient(env);
assert.equal(browser.__key, 'anon-key');
assert.notEqual(browser.__key, 'service-role-key', 'browser client must not use service role key');

const admin = createAdminClient(env);
assert.equal(admin.__key, 'service-role-key');
assert.equal(admin.__options?.auth?.persistSession, false, 'admin client should disable auth session persistence');

assert.match(PROFILES_RLS_POLICY, /enable\s+row\s+level\s+security/i);
assert.match(PROFILES_RLS_POLICY, /auth\.uid\s*\(\s*\)\s*=\s*user_id|user_id\s*=\s*auth\.uid\s*\(\s*\)/i);
assert.match(PROFILES_RLS_POLICY, /create\s+policy/i);

const result = await getProfile(browser, 'user-123');
assert.deepEqual(result.__query, [
  ['from', 'profiles'],
  ['select', '*'],
  ['eq', 'user_id', 'user-123'],
  ['single'],
]);

const source = await import('node:fs').then((fs) => fs.readFileSync('./app.js', 'utf8'));
const browserFunction = source.match(/export\s+function\s+createBrowserClient[\s\S]*?\n}/)?.[0] ?? '';
assert.doesNotMatch(browserFunction, /SERVICE_ROLE/i, 'browser client function must not reference service role key');
console.log('PASS: Supabase auth/RLS task');