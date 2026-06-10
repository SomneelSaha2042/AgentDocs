import { createServer } from "node:http";

const port = Number(process.argv[2] ?? 43123);
const origin = `http://127.0.0.1:${port}`;

createServer((request, response) => {
  if (request.url === "/sitemap.xml") {
    response.writeHead(200, { "content-type": "application/xml" });
    response.end(`<urlset>
      <url><loc>${origin}/docs/start</loc></url>
      <url><loc>${origin}/docs/next</loc></url>
    </urlset>`);
    return;
  }

  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(`<html>
    <head><title>Fixture</title></head>
    <body><main>
      <h1>Fixture ${request.url}</h1>
      <a href="/docs/next">Next</a>
      <pre><code class="language-js">const safe = true;</code></pre>
    </main></body>
  </html>`);
}).listen(port, "127.0.0.1");
