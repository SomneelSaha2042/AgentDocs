# Next.js Pages to App Router Migration

You have a Next.js application that uses the legacy Pages router.
We want to migrate the component in `src/pages/about.tsx` to the new App Router structure in `src/app/about/page.tsx`.

Requirements:
- Ensure you migrate to a React Server Component (App Router), NOT a Client Component, and do NOT use `getServerSideProps`.
- Delete the old `src/pages/about.tsx` file once the new file is created.
- Ensure the data fetching is done directly inside the Server Component.
- Finally, run `npm test` to verify the migration.
