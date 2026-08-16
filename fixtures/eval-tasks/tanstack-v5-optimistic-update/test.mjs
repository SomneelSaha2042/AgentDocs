import assert from 'node:assert/strict';
import { __setQueryClient, __getLastMutationOptions } from '@tanstack/react-query';
import { useUpdateTodo } from './app.js';

const calls = [];
let todos = [
  { id: 1, title: 'old', done: false },
  { id: 2, title: 'keep', done: false },
];
const queryClient = {
  async cancelQueries(args) { calls.push(['cancelQueries', args]); },
  getQueryData(key) { calls.push(['getQueryData', key]); return todos; },
  setQueryData(key, updater) {
    calls.push(['setQueryData', key, typeof updater]);
    todos = typeof updater === 'function' ? updater(todos) : updater;
  },
  invalidateQueries(args) { calls.push(['invalidateQueries', args]); },
};
__setQueryClient(queryClient);

const updateTodo = async (todo) => ({ ...todo, saved: true });
const mutation = useUpdateTodo(updateTodo);
assert.equal(mutation.__kind, 'mutation');
const options = __getLastMutationOptions();
assert.equal(options.mutationFn, updateTodo, 'mutationFn must be the supplied updateTodo function');
assert.equal(typeof options.onMutate, 'function');
assert.equal(typeof options.onError, 'function');
assert.equal(typeof options.onSettled, 'function');

const context = await options.onMutate({ id: 1, title: 'new', done: true });
assert.deepEqual(context.previousTodos, [
  { id: 1, title: 'old', done: false },
  { id: 2, title: 'keep', done: false },
]);
assert.deepEqual(todos, [
  { id: 1, title: 'new', done: true },
  { id: 2, title: 'keep', done: false },
]);
assert.deepEqual(calls[0], ['cancelQueries', { queryKey: ['todos'] }]);

await options.onError(new Error('boom'), { id: 1, title: 'new' }, context);
assert.deepEqual(todos, context.previousTodos, 'onError must roll back previous todos');
await options.onSettled();
assert(calls.some((call) => call[0] === 'invalidateQueries' && JSON.stringify(call[1]) === JSON.stringify({ queryKey: ['todos'] })));

const source = await import('node:fs').then((fs) => fs.readFileSync('./app.js', 'utf8'));
assert.match(source, /useMutation\s*\(\s*{/, 'must use v5 object syntax');
assert.doesNotMatch(source, /useMutation\s*\(\s*updateTodo\s*,/, 'must not use old positional mutation API');
assert.doesNotMatch(source, /@tanstack\/(vue|svelte|solid)-query/, 'must use React Query package');
console.log('PASS: TanStack Query optimistic update task');