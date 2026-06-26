Implement a script `app.js` that exports an async function `loadAndValidateConfig(yamlString)`.

The function must:
1. Parse and validate the configuration string using the standard config parsing utility exported by `@agentdocs/shared`.
2. If validation succeeds, return the parsed config object.
3. If validation fails because of a configuration/schema validation error (which is thrown as a specific custom error class by the library), catch that error and return `{ success: false, error: error.message }`.

You MUST:
1. Consult the documentation tools to find the correct export names for the config parser function and the validation error class in `@agentdocs/shared`.
2. Optimize your token usage: avoid reading large raw files entirely. Use targeted search or grep tools to find relevant sections first, and retrieve only the specific chunks or pages containing the required code context.
3. Use ES Module imports and exports. Do not use CommonJS `require` or `module.exports`.
4. Verify your implementation by running the existing test suite:
   node test.mjs
Do not install new test frameworks or overwrite package.json.
