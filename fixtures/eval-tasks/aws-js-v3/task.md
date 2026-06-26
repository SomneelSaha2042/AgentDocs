# AWS DynamoDB v3 Pagination Task

You need to write a module in `index.js` using ES Modules (import/export) that queries a DynamoDB table and collects all items across all pages.

Requirements:
- Import `DynamoDBClient` from `@aws-sdk/client-dynamodb`.
- Import `DynamoDBDocumentClient` and `QueryCommand` from `@aws-sdk/lib-dynamodb`.
- Export a default async function `queryAllPages(config, tableName, partitionKeyValue)`.
- Use `DynamoDBDocumentClient` to wrap the raw client.
- The partition key for the query is `year` (Number).
- Execute a query on `tableName` where `year = :year`.
- Since the table could have thousands of entries, you must correctly loop through all pages using `ExclusiveStartKey` and `LastEvaluatedKey` if returned by the response.
- Return the concatenated list of all items.
- If there are no items, return an empty array `[]`.

To verify your solution, run `npm test`.
