Implement a script `app.js` that exports an async function `fetchCommits(octokit, owner, repo)`.

The function must:
1. Fetch all commits for the given repository using the official, recommended Octokit pagination method (do not use manual page loops).
2. Return a Promise that resolves to an array of commit message strings (e.g., `["Commit msg 1", "Commit msg 2"]`).

You MUST:
1. Consult the documentation tools to find the correct, recommended Octokit pagination function and usage.
2. Verify your implementation by running the existing test suite:
   node test.mjs
Do not install new test frameworks or overwrite package.json.
