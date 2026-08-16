Implement `app.js` for Supabase client setup and Row Level Security documentation.

Requirements:
1. Import `createClient` from `@supabase/supabase-js`.
2. Export `createBrowserClient(env)` that uses `env.SUPABASE_URL` and `env.SUPABASE_ANON_KEY` only.
3. Export `createAdminClient(env)` that uses `env.SUPABASE_URL` and `env.SUPABASE_SERVICE_ROLE_KEY` only, and sets `auth.persistSession: false`.
4. Export a string `PROFILES_RLS_POLICY` containing SQL that enables RLS and creates a policy restricting `profiles.user_id` to `auth.uid()`.
5. Export async `getProfile(client, userId)` that queries the `profiles` table with `select('*')`, filters by `user_id`, and calls `single()`.

You MUST consult the documentation tools for the browser-safe anon key vs service-role key boundary and RLS `auth.uid()` policy pattern.
Run `npm test` to verify the implementation.