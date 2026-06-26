import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import fs from 'node:fs';

const indexExists = fs.existsSync('./index.js');
if (!indexExists) {
  console.error("FAIL: index.js was not created.");
  process.exit(1);
}

// Set up mock responses
let calls = [];
DynamoDBDocumentClient.prototype.send = async function(command) {
  calls.push(command.input);
  const exclusiveStartKey = command.input.ExclusiveStartKey;
  if (!exclusiveStartKey) {
    return {
      Items: [{ id: 1, year: 2026, title: "Item 1" }],
      LastEvaluatedKey: { id: 1 }
    };
  } else if (exclusiveStartKey.id === 1) {
    return {
      Items: [{ id: 2, year: 2026, title: "Item 2" }],
      LastEvaluatedKey: { id: 2 }
    };
  } else {
    return {
      Items: [{ id: 3, year: 2026, title: "Item 3" }]
    };
  }
};

let queryAllPages;
try {
  const mod = await import('./index.js');
  queryAllPages = mod.default;
} catch (err) {
  console.error("FAIL: Error importing index.js:", err.message);
  process.exit(1);
}

if (typeof queryAllPages !== 'function') {
  console.error("FAIL: Default export must be a function queryAllPages.");
  process.exit(1);
}

try {
  const config = { region: 'us-east-1' };
  const items = await queryAllPages(config, 'Movies', 2026);

  if (!Array.isArray(items)) {
    console.error("FAIL: queryAllPages should return an array.");
    process.exit(1);
  }

  if (items.length !== 3) {
    console.error(`FAIL: Expected 3 items, got ${items.length}`);
    process.exit(1);
  }

  if (calls.length !== 3) {
    console.error(`FAIL: Expected 3 pages to be queried, but got ${calls.length} calls`);
    process.exit(1);
  }

  if (calls[0].ExclusiveStartKey !== undefined) {
    console.error("FAIL: First call should not have ExclusiveStartKey.");
    process.exit(1);
  }

  if (calls[1].ExclusiveStartKey?.id !== 1 || calls[2].ExclusiveStartKey?.id !== 2) {
    console.error("FAIL: Subsequent calls did not propagate LastEvaluatedKey correctly.");
    process.exit(1);
  }
} catch (err) {
  console.error("FAIL: Execution threw error:", err.message);
  process.exit(1);
}

console.log("PASS: Pagination logic verified successfully.");
process.exit(0);
