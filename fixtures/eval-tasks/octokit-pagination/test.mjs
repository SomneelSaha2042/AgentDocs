import { fetchCommits } from './app.js';
import assert from 'node:assert';

// Create a mock octokit instance
const mockCommits = [
  { commit: { message: "First commit" } },
  { commit: { message: "Second commit" } }
];

let paginateCalledWith = null;

const mockOctokit = {
  rest: {
    repos: {
      listCommits: function() {} // Dummy function placeholder
    }
  },
  paginate: async function(endpoint, params, callback) {
    paginateCalledWith = { endpoint, params };
    if (callback) {
      return callback({ data: mockCommits });
    }
    return mockCommits;
  }
};

const result = await fetchCommits(mockOctokit, "test-owner", "test-repo");

assert.deepStrictEqual(result, ["First commit", "Second commit"]);
assert.ok(paginateCalledWith, "octokit.paginate should be called");
assert.strictEqual(paginateCalledWith.endpoint, mockOctokit.rest.repos.listCommits, "Should use octokit.rest.repos.listCommits");
assert.strictEqual(paginateCalledWith.params.owner, "test-owner");
assert.strictEqual(paginateCalledWith.params.repo, "test-repo");

console.log("PASS");
