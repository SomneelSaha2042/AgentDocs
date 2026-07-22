Implement `app.js` exporting a React TanStack Query v5 hook `useUpdateTodo(updateTodo)`.

Requirements:
1. Import `useMutation` and `useQueryClient` from `@tanstack/react-query`.
2. Call `useQueryClient()` inside the hook.
3. Return `useMutation({ ... })` using the v5 object syntax.
4. Use `mutationFn: updateTodo`.
5. In `onMutate(updatedTodo)`, cancel `['todos']`, snapshot previous todos, optimistically replace the matching todo in `['todos']`, and return `{ previousTodos }`.
6. In `onError`, roll back `['todos']` from `context.previousTodos`.
7. In `onSettled`, invalidate `['todos']`.

You MUST consult documentation tools for the React v5 optimistic update pattern. Do not use Vue/Svelte syntax or the old positional `useMutation(fn, options)` API.
Run `npm test` to verify the implementation.