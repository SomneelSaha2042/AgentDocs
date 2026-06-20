# Live Dogfood Runs

Default tests are offline and fixture-based. These opt-in commands exercise the
scoped crawler against representative modern documentation sites.

## PyTorch Stable Documentation

```bash
agentdocs --out .dogfood/pytorch try \
  https://docs.pytorch.org/docs/stable/index.html \
  --goal "load and save a model" \
  --max-pages 40
```

Verify that the crawl manifest records a versioned `/docs/<version>/` scope and
does not collect unrelated PyTorch documentation products.

## AWS SDK for JavaScript v3

```bash
agentdocs --out .dogfood/aws-js-v3 try \
  https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/getting-started-nodejs.html \
  --goal "authenticate and create an S3 client" \
  --max-pages 40
```

Verify that AgentDocs discovers the AWS sitemap declaration from `robots.txt`,
stays inside the JavaScript v3 developer guide, and uses official Markdown
alternatives when the guide exposes them.

## Expanded Modern-Docs Matrix

Use the same bounded `try` workflow against:

- Microsoft Learn Azure Storage:
  `https://learn.microsoft.com/en-us/azure/storage/blobs/storage-quickstart-blobs-nodejs`
- Google Cloud Storage:
  `https://cloud.google.com/storage/docs/uploading-objects`
- Kubernetes tasks:
  `https://kubernetes.io/docs/tasks/run-application/run-stateless-application-deployment/`
- Docker build concepts:
  `https://docs.docker.com/get-started/docker-concepts/building-images/build-tag-and-publish-an-image/`
- GitHub REST API:
  `https://docs.github.com/en/rest/using-the-rest-api/getting-started-with-the-rest-api`
- Stripe payments:
  `https://docs.stripe.com/payments/accept-a-payment`

Azure, Google Cloud, Kubernetes, Docker, GitHub, and AWS should produce useful
scoped pages. Stripe currently depends on embedded application state and should
fail with exit code `3`, preserve raw diagnostics, and avoid a misleading
successful build.

For every run, inspect extraction quality as well as page counts. A successful
run must contain useful chunks; empty or heading-only pages are recorded under
`unusablePages` with raw snapshots, and a crawl with no useful pages must fail
after writing diagnostics. Also verify that `agentdocs context "<goal>"`
returns complementary goal-bundle evidence rather than an unrelated task pack.

Live documentation changes over time, so these commands are intentionally not
part of the default test suite.

## Standard Regression Capture

Run the same regression capture for every prepared target:

```bash
pnpm regression:dogfood -- .dogfood/hono-website \
  --agent-task-passed unknown \
  --search-auth-good unknown \
  --search-quickstart-good true \
  --query middleware=middleware \
  --query cloudflare-workers="Cloudflare Workers"
```

The runner builds twice, verifies stable generated-artifact hashes, runs the
doctor and the standard `authentication`, `quickstart`, and `error handling`
searches, and writes:

```txt
results/
  build.json
  build-repeat.json
  doctor.json
  search-auth.json
  search-quickstart.json
  search-errors.json
  summary.json
  summary.csv
```

`summary.json` records pages, chunks, entities, task packs, readiness, source
coverage, broken links, warnings, deprecations, top-five search results, and
repeated-build hashes. `summary.csv` includes compact source coverage ratio and
gap columns. The cross-target table is updated at
`.dogfood/regression-summary.csv`.

Do not use unexplained `N/A` for missing confidence. Label every missing or
partial metric with one of:

```txt
unsupported_format
scale_limited
scope_mismatch
retrieval_mismatch
historical_metric_not_captured
preparation_blocked
```

For large repositories, prefer explicit scoped local sources until large-repo
budgets and progress controls are implemented. For example, test a docs shard
with config `include` rules such as `docs/ai/**/*.md` instead of treating a
timeout from a whole-repo run as a readiness result. Record whole-repo timeouts
as `scale_limited` and include the scoped source path in the regression notes.

See the [dogfood workflow matrix](./workflow-matrix.md) for the requested repo
preparation, workflow-specific queries, pass criteria, and agent tasks.

Keep `agent_task_passed` as an explicit human judgment. Retrieval and readiness
metrics are supporting signals; the primary product test is whether an agent
can complete the target task using the generated context.
