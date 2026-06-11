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
