# Pages Router Routing

In Next.js Pages Router, pages are associated with a file based on its file name in `src/pages`.
For data fetching, you use `getServerSideProps` for Server-Side Rendering:
```js
export async function getServerSideProps() {
  const res = await fetch('https://api.example.com/data');
  const data = await res.json();
  return { props: { data } };
}
```
