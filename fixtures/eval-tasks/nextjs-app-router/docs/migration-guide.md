# Migrating from Pages to App Router

To migrate:
1. Move your component from `src/pages/about.tsx` to `src/app/about/page.tsx`.
2. Remove `getServerSideProps`.
3. Fetch data directly in the React Server Component. For example:
```js
// src/app/about/page.tsx
export default async function AboutPage() {
  const data = await fetch('https://api.example.com/about').then(res => res.json());
  return <div><h1>About</h1><p>{data.description}</p></div>;
}
```
4. Delete the old `src/pages/about.tsx`.
