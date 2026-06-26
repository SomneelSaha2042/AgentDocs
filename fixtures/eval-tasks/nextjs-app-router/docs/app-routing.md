# App Router Routing

In the App Router, files named `page.js` (or `.tsx`) inside the `src/app` directory define routes.
By default, components in the App Router are React Server Components.
You fetch data directly in the component using async/await:
```js
export default async function Page() {
  const res = await fetch('https://api.example.com/data');
  const data = await res.json();
  return <div>{data.title}</div>;
}
```
