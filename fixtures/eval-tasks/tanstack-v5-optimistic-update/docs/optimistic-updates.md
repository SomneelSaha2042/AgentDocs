# Optimistic Updates

When performing an optimistic update, you need to use `useQueryClient` to manually update the cache before the mutation completes.

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query'

const queryClient = useQueryClient()

return useMutation({
  mutationFn: updateTodo,
  onMutate: async (newTodo) => {
    await queryClient.cancelQueries({ queryKey: ['todos'] })
    const previousTodos = queryClient.getQueryData(['todos'])
    queryClient.setQueryData(['todos'], (old = []) =>
      old.map((todo) => todo.id === newTodo.id ? { ...todo, ...newTodo } : todo)
    )
    return { previousTodos }
  },
  onError: (_err, _newTodo, context) => {
    queryClient.setQueryData(['todos'], context.previousTodos)
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['todos'] })
  },
})
```
